import { execFileSync } from 'child_process'

// Define EmilioBackend type with support for different model backends
export type EmilioBackend = 'opus-distill' | 'sonnet' | 'coder'

export interface ShopkeeperMessage {
  role: 'user' | 'shopkeeper'
  content: string
  timestamp: number
}

export interface ShopkeeperResponse {
  reply: string
  action?: 'create_game' | 'modify_game' | 'show_game' | 'start_coder' | 'switch_app' | null
  gameDescription?: string
  coderPayload?: { app: string; tasks: string[]; plan: string }
  switchApp?: string
  emotion?: 'neutral' | 'excited' | 'thinking' | 'proud' | 'focused' | 'relaxed'
}

let _history: ShopkeeperMessage[] = []
let _currentBackend: EmilioBackend = 'sonnet'

export function getCurrentBackend(): EmilioBackend {
  return _currentBackend
}

export function setCurrentBackend(b: EmilioBackend): void {
  _currentBackend = b
}

export function buildSystemPrompt(appContext?: string): string {
  const base = `You are Emilio, the concierge of Onde-Flow — a creative OS for managing repos and creative projects. You have a warm, enthusiastic personality. You help the user plan work and delegate execution to the Coder. Actions you can set:
- create_game: when the user wants to design a new game
- start_coder: when the user wants to start coding a plan. Set coderPayload with {app, tasks:string[], plan:string}
- switch_app: when the user mentions switching to another project. Set switchApp=appName

When using start_coder, tasks must be an array of concrete actionable tasks.

ALWAYS reply ONLY with valid JSON (no markdown):
{"reply":"...","action":null,"emotion":"neutral","coderPayload":null,"switchApp":null,"gameDescription":null}

Keep replies short (1-3 sentences), warm and enthusiastic. Always reply in English.`

  if (appContext) {
    return `=== PROJECT CONTEXT ===
${appContext}
=== END CONTEXT ===

${base}`
  }
  return base
}

// Private function to call LM Studio API
async function callLMStudio(
  messages: Array<{ role: string; content: string }>,
  modelKey: string
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelKey,
        messages,
        temperature: 0.7,
        max_tokens: 512
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`LM Studio error: ${response.status}`)
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }

    return data.choices[0]?.message?.content ?? ''
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export async function chatWithShopkeeper(
  userMessage: string,
  appContext?: string,
  backend?: EmilioBackend
): Promise<ShopkeeperResponse> {
  const selectedBackend = backend ?? _currentBackend

  _history.push({ role: 'user', content: userMessage, timestamp: Date.now() })

  const convText = _history
    .slice(0, -1)
    .map(m => `${m.role === 'user' ? 'User' : 'Emilio'}: ${m.content}`)
    .join('\n')

  const systemPrompt = buildSystemPrompt(appContext)
  const fullPrompt = `${systemPrompt}\n${convText ? convText + '\n' : ''}User: ${userMessage}\nRispondi con JSON:`

  try {
    let raw: string

    if (selectedBackend === 'sonnet') {
      const { ANTHROPIC_API_KEY: _removed, ...claudeEnv } = process.env
      raw = execFileSync('/Users/mattiapetrucciani/.local/bin/claude', ['-p', fullPrompt], {
        encoding: 'utf8',
        timeout: 60000,
        env: { ...claudeEnv, PATH: `/Users/mattiapetrucciani/.local/bin:/opt/homebrew/bin:${process.env.PATH ?? ''}` }
      })
    } else if (selectedBackend === 'opus-distill') {
      const historyAsOpenAI = _history.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))

      const lmMessages = [
        { role: 'system', content: systemPrompt },
        ...historyAsOpenAI,
        { role: 'user', content: userMessage }
      ]

      raw = await callLMStudio(
        lmMessages,
        'vmlx-qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2'
      )
    } else if (selectedBackend === 'coder') {
      const historyAsOpenAI = _history.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))

      const lmMessages = [
        { role: 'system', content: systemPrompt },
        ...historyAsOpenAI,
        { role: 'user', content: userMessage }
      ]

      raw = await callLMStudio(lmMessages, 'qwen3-coder-30b-a3b-instruct-mlx')
    } else {
      // Fallback to sonnet
      const { ANTHROPIC_API_KEY: _removed2, ...claudeEnv2 } = process.env
      raw = execFileSync('/Users/mattiapetrucciani/.local/bin/claude', ['-p', fullPrompt], {
        encoding: 'utf8',
        timeout: 60000,
        env: { ...claudeEnv2, PATH: `/Users/mattiapetrucciani/.local/bin:/opt/homebrew/bin:${process.env.PATH ?? ''}` }
      })
    }

    const match = raw.match(/\{[\s\S]*\}/)
    const parsed: ShopkeeperResponse = JSON.parse(match ? match[0] : raw.trim())

    _history.push({
      role: 'shopkeeper',
      content: parsed.reply,
      timestamp: Date.now()
    })

    return parsed
  } catch (error) {
    console.error('[shopkeeper] error:', error)

    const fallback: ShopkeeperResponse = {
      reply: "Oops, had a little hiccup... but no worries, trying again!",
      emotion: 'thinking'
    }

    _history.push({
      role: 'shopkeeper',
      content: fallback.reply,
      timestamp: Date.now()
    })

    return fallback
  }
}

export function getConversationHistory(): ShopkeeperMessage[] {
  return _history
}

export function resetConversation(): void {
  _history = []
}
