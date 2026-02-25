import fs from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import type { AnalysisResult, CodeChange } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers — OAuth Keychain (strategia 2)
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'

function readKeychain(account: string): any | null {
  try {
    const raw = execFileSync(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-a', account, '-w'],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()
    return JSON.parse(raw)
  } catch { return null }
}

function writeKeychain(account: string, credsJson: string): void {
  try {
    execFileSync('security', ['delete-generic-password', '-s', 'Claude Code-credentials', '-a', account],
      { stdio: 'pipe' })
  } catch { /* non esisteva */ }
  execFileSync('security', ['add-generic-password', '-s', 'Claude Code-credentials', '-a', account, '-w', credsJson],
    { stdio: 'pipe' })
}

/**
 * Ritorna un access token valido per l'account mattiapetrucciani.
 * Se il token è scaduto lo rinnova automaticamente via platform.claude.com.
 */
function getFreshAccessToken(): string {
  const accounts = ['mattiapetrucciani', 'Claude Code']
  for (const account of accounts) {
    const creds = readKeychain(account)
    if (!creds?.claudeAiOauth) continue

    const { accessToken, refreshToken, expiresAt } = creds.claudeAiOauth
    const nowMs = Date.now()

    if (expiresAt > nowMs + 60_000) return accessToken

    if (!refreshToken) continue
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }).toString()

      const result = spawnSync('curl', [
        '-s', '-X', 'POST',
        'https://platform.claude.com/v1/oauth/token',
        '-H', 'Content-Type: application/x-www-form-urlencoded',
        '-d', body,
      ], { encoding: 'utf-8' })

      const resp = JSON.parse(result.stdout)
      if (!resp.access_token) continue

      const newCreds = {
        ...creds,
        claudeAiOauth: {
          ...creds.claudeAiOauth,
          accessToken: resp.access_token,
          refreshToken: resp.refresh_token || refreshToken,
          expiresAt: Date.now() + (resp.expires_in || 28800) * 1000,
        },
      }
      writeKeychain(account, JSON.stringify(newCreds))
      return resp.access_token
    } catch { continue }
  }
  throw new Error('Impossibile ottenere un token Anthropic valido. Esegui "claude auth login".')
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude CLI subprocess — strategia 3 (fallback finale)
// ─────────────────────────────────────────────────────────────────────────────

function callClaudeCLI(prompt: string, timeoutMs = 120_000): string {
  const env = { ...process.env }
  delete env.CLAUDECODE

  const result = spawnSync(
    'claude',
    ['-p', '--output-format', 'json', '--model', 'claude-sonnet-4-6'],
    {
      input: prompt,
      encoding: 'utf-8',
      timeout: timeoutMs,
      env,
      cwd: process.cwd(),
    }
  )

  if (result.error) throw new Error(`claude CLI error: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`claude CLI exit ${result.status}: ${result.stderr?.slice(0, 200)}`)

  try {
    const parsed = JSON.parse(result.stdout)
    return parsed.result ?? result.stdout
  } catch {
    return result.stdout
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategia 0: Local MLX server — Qwen3-Coder-30B-A3B (testo/codice only)
// Serve con: mlx_lm.server --model mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit --port 8080
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://localhost:8080'
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit'

async function callLocalLLM(messages: any[], maxTokens = 4000): Promise<{ text: string; tokens: number }> {
  const textMessages = messages.map(m => ({
    role: m.role,
    content: Array.isArray(m.content)
      ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
      : m.content,
  }))

  const resp = await fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LOCAL_LLM_MODEL,
      messages: textMessages,
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!resp.ok) throw new Error(`Local LLM ${resp.status}: ${await resp.text().then(t => t.slice(0, 100))}`)
  const data = await resp.json()
  return {
    text: data.choices[0].message.content,
    tokens: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// callAI — 4 strategie in ordine di priorità:
// 0) Local MLX (Qwen3-Coder-30B) — solo per messaggi SENZA immagini
// 1) ANTHROPIC_API_KEY env var  (sempre preferita per vision)
// 2) SDK con Bearer token OAuth da macOS Keychain
// 3) CLI subprocess fallback (no vision, solo testo)
// ─────────────────────────────────────────────────────────────────────────────

async function callAI(messages: any[], maxTokens = 2000): Promise<{ text: string; tokens: number }> {
  const hasImages = messages.some(m =>
    Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image')
  )

  // Strategia 0: Local MLX — solo per task testo/codice (no vision)
  if (!hasImages) {
    try {
      const result = await callLocalLLM(messages, maxTokens)
      console.log('[ai] ✓ Local MLX (Qwen3-Coder-30B) — tokens:', result.tokens)
      return result
    } catch (localErr) {
      console.log('[ai] Local MLX non disponibile:', (localErr as Error).message.slice(0, 80))
      console.log('[ai] Fallback → Claude')
    }
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')

  // Strategia 1: ANTHROPIC_API_KEY env var
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages,
    })
    return {
      text: resp.content[0].type === 'text' ? resp.content[0].text : '',
      tokens: (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0),
    }
  }

  // Strategia 2: SDK con Bearer token OAuth (Keychain)
  try {
    const token = getFreshAccessToken()
    const client = new Anthropic({ authToken: token, apiKey: null as any })
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages,
    })
    return {
      text: resp.content[0].type === 'text' ? resp.content[0].text : '',
      tokens: (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0),
    }
  } catch (oauthErr) {
    console.log('[ai] OAuth SDK failed:', (oauthErr as Error).message.slice(0, 80))
  }

  // Strategia 3: CLI subprocess — estrae solo i contenuti testuali (no vision)
  const textParts = messages.flatMap(m =>
    Array.isArray(m.content)
      ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text)
      : [m.content]
  )
  const text = callClaudeCLI(textParts.join('\n'), 90_000)
  return { text, tokens: 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers immagini
// ─────────────────────────────────────────────────────────────────────────────

function imageToBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString('base64')
}

function getMediaType(filePath: string): 'image/png' | 'image/jpeg' {
  const ext = filePath.split('.').pop()?.toLowerCase()
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
}

// ─────────────────────────────────────────────────────────────────────────────
// API pubblica
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analizza screenshot vs reference con Claude Vision.
 * Auth: 1) ANTHROPIC_API_KEY → 2) OAuth Keychain → 3) CLI (no vision)
 */
export async function analyzeScreenshot(
  currentScreenshot: string,
  referenceImage: string,
  context: string
): Promise<AnalysisResult> {
  const prompt = `You are a game art director comparing a current game screenshot against a reference image.

CONTEXT:
${context}

REFERENCE IMAGE (target look): ${referenceImage}
CURRENT SCREENSHOT: ${currentScreenshot}

Analyze the visual differences between CURRENT and REFERENCE.
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "gaps": [
    { "element": "string", "current": "string", "target": "string", "fix": "string" }
  ],
  "summary": "1-2 sentences describing the biggest gaps",
  "suggestedFiles": ["BuildingBuilder.cs"]
}

Focus on: flat colors vs shading, saturation, missing elements, proportions, style.
suggestedFiles must be exact C# filenames from Assets/Scripts/Builders/ or Core/.`

  const messagesWithImages = [{
    role: 'user',
    content: [
      { type: 'text', text: prompt.split('\n').slice(0, 10).join('\n') },
      { type: 'image', source: { type: 'base64', media_type: getMediaType(referenceImage), data: imageToBase64(referenceImage) } },
      { type: 'text', text: '^^^ REFERENCE IMAGE' },
      { type: 'image', source: { type: 'base64', media_type: getMediaType(currentScreenshot), data: imageToBase64(currentScreenshot) } },
      { type: 'text', text: '^^^ CURRENT SCREENSHOT\n\nReturn JSON only.' },
    ],
  }]

  try {
    const { text, tokens } = await callAI(messagesWithImages, 2000)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return { ...JSON.parse(jsonStr), tokensUsed: tokens }
  } catch (err) {
    console.log('[ai] analyzeScreenshot failed:', (err as Error).message.slice(0, 80))
    return {
      gaps: [{ element: 'auth_error', current: 'N/A', target: 'N/A', fix: (err as Error).message.slice(0, 100) }],
      summary: 'Analisi fallita. Verifica ANTHROPIC_API_KEY in .env.local.',
      suggestedFiles: [],
      tokensUsed: 0,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL VISION — Qwen2.5-VL-7B via mlx_vlm.server (OpenAI-compatible API)
// Usato dal loop quando useLocalAI=true. Il server deve essere già avviato.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analizza screenshot vs reference usando Qwen2.5-VL locale (mlx_vlm.server).
 * Il server deve essere attivo su visionUrl prima di chiamare questa funzione.
 */
export async function analyzeScreenshotLocal(
  currentScreenshot: string,
  referenceImage: string,
  context: string,
  visionUrl: string,
  visionModel: string,
): Promise<AnalysisResult> {
  const prompt = `You are a game art director comparing a current game screenshot against a reference image.

CONTEXT:
${context}

Analyze the visual differences between CURRENT and REFERENCE.
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "gaps": [
    { "element": "string", "current": "string", "target": "string", "fix": "string" }
  ],
  "summary": "1-2 sentences describing the biggest gaps",
  "suggestedFiles": ["BuildingBuilder.cs"]
}

Focus on: flat colors vs shading, saturation, missing elements, proportions, style.
suggestedFiles must be exact C# filenames from Assets/Scripts/Builders/ or Core/.`

  const toDataUrl = (filePath: string) => {
    const b64 = imageToBase64(filePath)
    const mime = getMediaType(filePath)
    return `data:${mime};base64,${b64}`
  }

  const body = {
    model: visionModel,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: toDataUrl(referenceImage) } },
        { type: 'text', text: '^^^ REFERENCE IMAGE (target look)' },
        { type: 'image_url', image_url: { url: toDataUrl(currentScreenshot) } },
        { type: 'text', text: '^^^ CURRENT SCREENSHOT\n\nReturn JSON only.' },
      ],
    }],
    max_tokens: 2000,
    temperature: 0.1,
  }

  try {
    const resp = await fetch(`${visionUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })
    if (!resp.ok) throw new Error(`Vision LLM ${resp.status}`)
    const data = await resp.json()
    const text: string = data.choices[0].message.content
    const tokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return { ...JSON.parse(jsonStr), tokensUsed: tokens }
  } catch (err) {
    console.log('[ai] analyzeScreenshotLocal failed:', (err as Error).message.slice(0, 80))
    return {
      gaps: [{ element: 'local_vision_error', current: 'N/A', target: 'N/A', fix: (err as Error).message.slice(0, 100) }],
      summary: 'Analisi locale fallita.',
      suggestedFiles: [],
      tokensUsed: 0,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL CODER — Qwen3-Coder-30B via mlx_lm.server (già in callLocalLLM)
// Usato dal loop quando useLocalAI=true. Il server deve essere già avviato.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera modifiche C# usando Qwen3-Coder locale (mlx_lm.server).
 * Il server deve essere attivo su coderUrl prima di chiamare questa funzione.
 */
/**
 * Estrae una finestra rilevante del file attorno alle keyword del gap analysis.
 * Max 500 righe — mlx_lm.server crasha con file > ~600 righe (context overflow).
 */
// Qwen3-Coder-30B-A3B ha 17GB weights — il KV cache con >2000 token causa OOM GPU.
// Con 200 righe (~1500 token) si resta nel safe zone.
function extractRelevantSection(content: string, keywords: string[], windowLines = 200): string {
  const lines = content.split('\n')
  if (lines.length <= windowLines) return content

  // Determina se il gap riguarda colori → cerca solo righe con "new Color("
  const isColorGap = keywords.some(k => /color/i.test(k))
  const candidateLines = isColorGap
    ? lines.map((l, i) => ({ l, i })).filter(({ l }) => /new Color\(/.test(l))
    : lines.map((l, i) => ({ l, i }))

  // Score per riga: word-boundary (evita helmetC vs helmetColor)
  const scoreFor = (line: string, kw: string): number => {
    const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${safe}\\b`).test(line)) return 2
    if (line.toLowerCase().includes(kw.toLowerCase())) return 1
    return 0
  }

  const keys = keywords.filter(k => k.length > 3)
  let centerLine = 0
  let bestScore = -1
  for (const { l, i } of candidateLines) {
    const score = keys.reduce((sum, k) => sum + scoreFor(l, k), 0)
    if (score > bestScore) {
      bestScore = score
      centerLine = i
    }
  }

  const half = Math.floor(windowLines / 2)
  const start = Math.max(0, centerLine - half)
  const end = Math.min(lines.length, centerLine + half)
  const prefix = start > 0 ? `// ... (${start} lines above omitted)\n` : ''
  const suffix = end < lines.length ? `\n// ... (${lines.length - end} lines below omitted)` : ''
  return prefix + lines.slice(start, end).join('\n') + suffix
}

export async function generateCodeChangesLocal(
  analysis: AnalysisResult,
  currentFileContent: string,
  fileName: string,
  coderUrl: string,
  coderModel: string,
): Promise<{ changes: CodeChange[]; tokensUsed: number }> {
  // Estrai keyword dal gap analysis per trovare la sezione rilevante
  const keywords = analysis.gaps.flatMap(g => [g.element, g.fix].join(' ').split(/\s+/)).filter(k => k.length > 3)
  const fileSection = extractRelevantSection(currentFileContent, keywords)

  const prompt = `You are a Unity C# code modifier. Generate MINIMAL changes to fix the visual gaps.

GAP ANALYSIS:
${JSON.stringify(analysis.gaps, null, 2)}

SUMMARY: ${analysis.summary}

FILE: ${fileName}
CURRENT CONTENT:
\`\`\`csharp
${fileSection}
\`\`\`

Return ONLY a valid JSON array (no markdown):
[
  {
    "filePath": "${fileName}",
    "oldCode": "exact substring to replace",
    "newCode": "replacement code",
    "description": "what this fixes"
  }
]

RULES:
- oldCode must be an EXACT substring found in the file above
- Make MINIMAL changes — prefer changing values, not restructuring
- Return empty array [] if no changes are needed`

  try {
    const resp = await fetch(`${coderUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: coderModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(180_000),
    })
    if (!resp.ok) throw new Error(`Coder LLM ${resp.status}: ${await resp.text()}`)
    const data = await resp.json()
    const rawText: string = data.choices[0].message.content
    const tokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)

    // Qwen3-Coder è un modello "thinking": emette <think>...</think> prima del JSON
    const noThink = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    // Rimuovi blocchi ```json...``` se presenti
    const cleaned = noThink.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    // Estrai il primo array JSON trovato nel testo
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) {
      console.error('[coder] No JSON array found. Raw output (first 500):', rawText.slice(0, 500))
      return { changes: [], tokensUsed: tokens }
    }
    const changes: CodeChange[] = JSON.parse(match[0])
    return { changes: Array.isArray(changes) ? changes : [], tokensUsed: tokens }
  } catch (err) {
    const e = err as any
    console.error('[coder] error:', e?.message, '| cause:', e?.cause?.message || e?.cause?.code || e?.cause)
    return { changes: [], tokensUsed: 0 }
  }
}

/**
 * Genera modifiche C# basate sull'analisi gap.
 */
export async function generateCodeChanges(
  analysis: AnalysisResult,
  currentFileContent: string,
  fileName: string
): Promise<{ changes: CodeChange[]; tokensUsed: number }> {
  const prompt = `You are a Unity C# code modifier. Generate MINIMAL changes to fix the visual gaps.

GAP ANALYSIS:
${JSON.stringify(analysis.gaps, null, 2)}

SUMMARY: ${analysis.summary}

FILE: ${fileName}
CURRENT CONTENT:
\`\`\`csharp
${currentFileContent}
\`\`\`

Return ONLY a valid JSON array (no markdown):
[
  {
    "filePath": "${fileName}",
    "oldCode": "exact substring to replace",
    "newCode": "replacement code",
    "description": "what this fixes"
  }
]

RULES:
- oldCode must be an EXACT substring found in the file above
- Make MINIMAL changes — prefer changing values, not restructuring
- Return empty array [] if no changes are needed`

  try {
    const { text, tokens } = await callAI([{ role: 'user', content: prompt }], 4000)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const changes: CodeChange[] = JSON.parse(jsonStr)
    return { changes: Array.isArray(changes) ? changes : [], tokensUsed: tokens }
  } catch {
    return { changes: [], tokensUsed: 0 }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PM SUMMARY — genera riassunto high-level per il Project Manager
// Chiamato dopo generateCodeChanges. Usa lo stesso backend attivo (local/Claude).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera 1-2 frasi high-level che descrivono cosa è stato fatto nell'iterazione.
 * Es: "Migliorati i colori degli edifici: palette più satura con Unlit/Color.
 *      Portici resi più bianchi e prominenti in BuildingBuilder."
 */
export async function generatePMSummary(
  analysis: AnalysisResult,
  changes: CodeChange[],
  localCoderUrl?: string,
  localCoderModel?: string,
): Promise<string> {
  if (changes.length === 0) return analysis.summary || 'No changes made this iteration.'

  const prompt = `You are summarizing a game development iteration for a project manager.

VISUAL GAPS FOUND:
${analysis.gaps.map(g => `- ${g.element}: ${g.fix}`).join('\n')}

CODE CHANGES MADE:
${changes.map(c => `- ${c.filePath}: ${c.description}`).join('\n')}

Write 1-2 SHORT sentences (max 120 chars total) summarizing what was DONE (past tense).
Focus on outcomes, not code details. Be specific about what visually improved.
No markdown, no bullets, plain text only.`

  try {
    let text: string
    if (localCoderUrl && localCoderModel) {
      const resp = await fetch(`${localCoderUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localCoderModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!resp.ok) throw new Error('local coder failed')
      const data = await resp.json()
      text = data.choices[0].message.content.trim()
    } else {
      const result = await callAI([{ role: 'user', content: prompt }], 150)
      text = result.text.trim()
    }
    return text.slice(0, 200) // max 200 chars
  } catch {
    // Fallback: costruisce summary dai dati disponibili
    const files = [...new Set(changes.map(c => c.filePath))].join(', ')
    return `${analysis.summary} [Files: ${files}]`.slice(0, 200)
  }
}
