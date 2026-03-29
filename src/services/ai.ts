import fs from 'node:fs'
import type { AnalysisResult, CodeChange } from '@/lib/types'

const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://localhost:1234'
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen3-coder-30b-a3b-instruct-mlx'

async function callLocalLLM(messages: any[], maxTokens = 4000): Promise<{ text: string; tokens: number }> {
  const textMessages = messages.map(m => ({ role: m.role, content: Array.isArray(m.content) ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') : m.content }))
  const resp = await fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: LOCAL_LLM_MODEL, messages: textMessages, max_tokens: maxTokens, temperature: 0.1 }), signal: AbortSignal.timeout(120_000) })
  if (!resp.ok) throw new Error(`Local LLM ${resp.status}: ${await resp.text().then(t => t.slice(0, 100))}`)
  const data = await resp.json()
  return { text: data.choices[0].message.content, tokens: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0) }
}

function imageToBase64(filePath: string): string { return fs.readFileSync(filePath).toString('base64') }
function getMediaType(filePath: string): 'image/png' | 'image/jpeg' { const ext = filePath.split('.').pop()?.toLowerCase(); return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png' }

export async function analyzeScreenshot(_currentScreenshot: string, _referenceImage: string, _context: string): Promise<AnalysisResult> {
  throw new Error('Vision requires a running local vision model. Use analyzeScreenshotLocal() instead.')
}

function extractRelevantSection(content: string, keywords: string[], windowLines = 200): string {
  const lines = content.split('\n')
  if (lines.length <= windowLines) return content
  const isColorGap = keywords.some(k => /color/i.test(k))
  const candidateLines = isColorGap ? lines.map((l, i) => ({ l, i })).filter(({ l }) => /new Color\(/.test(l)) : lines.map((l, i) => ({ l, i }))
  const scoreFor = (line: string, kw: string): number => { const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (new RegExp(`\\b${safe}\\b`).test(line)) return 2; if (line.toLowerCase().includes(kw.toLowerCase())) return 1; return 0 }
  const keys = keywords.filter(k => k.length > 3)
  let centerLine = 0; let bestScore = -1
  for (const { l, i } of candidateLines) { const score = keys.reduce((sum, k) => sum + scoreFor(l, k), 0); if (score > bestScore) { bestScore = score; centerLine = i } }
  const half = Math.floor(windowLines / 2)
  const start = Math.max(0, centerLine - half); const end = Math.min(lines.length, centerLine + half)
  const prefix = start > 0 ? `// ... (${start} lines above omitted)\n` : ''
  const suffix = end < lines.length ? `\n// ... (${lines.length - end} lines below omitted)` : ''
  return prefix + lines.slice(start, end).join('\n') + suffix
}

export async function analyzeScreenshotLocal(currentScreenshot: string, referenceImage: string, context: string, visionUrl: string, visionModel: string): Promise<AnalysisResult> {
  const prompt = `You are a game art director comparing screenshots. Context: ${context}\nReturn JSON: {gaps:[{element,current,target,fix}],summary,suggestedFiles:[]}`
  const toDataUrl = (fp: string) => `data:${getMediaType(fp)};base64,${imageToBase64(fp)}`
  const body = { model: visionModel, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: toDataUrl(referenceImage) } }, { type: 'text', text: '^^^ REFERENCE' }, { type: 'image_url', image_url: { url: toDataUrl(currentScreenshot) } }, { type: 'text', text: '^^^ CURRENT. Return JSON only.' }] }], max_tokens: 2000, temperature: 0.1 }
  try {
    const resp = await fetch(`${visionUrl}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) })
    if (!resp.ok) throw new Error(`Vision LLM ${resp.status}`)
    const data = await resp.json()
    const text: string = data.choices[0].message.content
    const tokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)
    return { ...JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()), tokensUsed: tokens }
  } catch (err) { return { gaps: [{ element: 'local_vision_error', current: 'N/A', target: 'N/A', fix: (err as Error).message.slice(0, 100) }], summary: 'Analisi locale fallita.', suggestedFiles: [], tokensUsed: 0 } }
}

export async function generateCodeChangesLocal(analysis: AnalysisResult, currentFileContent: string, fileName: string, coderUrl: string, coderModel: string): Promise<{ changes: CodeChange[]; tokensUsed: number }> {
  const keywords = analysis.gaps.flatMap(g => [g.element, g.fix].join(' ').split(/\s+/)).filter(k => k.length > 3)
  const fileSection = extractRelevantSection(currentFileContent, keywords)
  const prompt = `Unity C# code modifier. Fix visual gaps.\nGAPS: ${JSON.stringify(analysis.gaps)}\nFILE ${fileName}:\n\`\`\`csharp\n${fileSection}\n\`\`\`\nReturn JSON array [{filePath,oldCode,newCode,description}] only. oldCode must be exact substring.`
  try {
    const resp = await fetch(`${coderUrl}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: coderModel, messages: [{ role: 'user', content: prompt }], max_tokens: 4000, temperature: 0.1 }), signal: AbortSignal.timeout(180_000) })
    if (!resp.ok) throw new Error(`Coder LLM ${resp.status}`)
    const data = await resp.json()
    const rawText: string = data.choices[0].message.content
    const tokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)
    const noThink = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    const cleaned = noThink.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return { changes: [], tokensUsed: tokens }
    return { changes: JSON.parse(match[0]), tokensUsed: tokens }
  } catch (err) { return { changes: [], tokensUsed: 0 } }
}

export async function generateCodeChanges(analysis: AnalysisResult, currentFileContent: string, fileName: string): Promise<{ changes: CodeChange[]; tokensUsed: number }> {
  const prompt = `Unity C# modifier. FILE: ${fileName}\n${currentFileContent}\nReturn JSON [{filePath,oldCode,newCode,description}]`
  try { const { text, tokens } = await callLocalLLM([{ role: 'user', content: prompt }], 4000); return { changes: JSON.parse(text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()), tokensUsed: tokens } } catch { return { changes: [], tokensUsed: 0 } }
}

export async function generatePMSummary(analysis: AnalysisResult, changes: CodeChange[], localCoderUrl?: string, localCoderModel?: string): Promise<string> {
  if (changes.length === 0) return analysis.summary || 'No changes made this iteration.'
  const prompt = `Summarize game dev iteration in 1-2 sentences max 120 chars. GAPS: ${analysis.gaps.map(g => g.fix).join(', ')}. CHANGES: ${changes.map(c => c.description).join(', ')}. Plain text only.`
  try {
    let text: string
    if (localCoderUrl && localCoderModel) {
      const resp = await fetch(`${localCoderUrl}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: localCoderModel, messages: [{ role: 'user', content: prompt }], max_tokens: 150, temperature: 0.3 }), signal: AbortSignal.timeout(30_000) })
      if (!resp.ok) throw new Error('local coder failed')
      const data = await resp.json()
      text = data.choices[0].message.content.trim()
    } else {
      const result = await callLocalLLM([{ role: 'user', content: prompt }], 150)
      text = result.text.trim()
    }
    return text.slice(0, 200)
  } catch {
    return `${analysis.summary} [Files: ${[...new Set(changes.map(c => c.filePath))].join(', ')}]`.slice(0, 200)
  }
}
