import { execFileSync } from 'child_process'

export interface ShopkeeperMessage {
  role: 'user' | 'shopkeeper'
  content: string
  timestamp: number
}

export interface ShopkeeperResponse {
  reply: string
  action?: 'create_game' | 'modify_game' | 'show_game' | null
  gameDescription?: string
  emotion?: 'neutral' | 'excited' | 'thinking' | 'proud'
}

let _history: ShopkeeperMessage[] = []

export async function chatWithShopkeeper(userMessage: string): Promise<ShopkeeperResponse> {
  _history.push({ role: 'user', content: userMessage, timestamp: Date.now() })

  const convText = _history
    .slice(0, -1) // exclude the message just added
    .map(m => `${m.role === 'user' ? 'User' : 'Gino'}: ${m.content}`)
    .join('\n')

  const fullPrompt = `You are Gino, a passionate Neapolitan game shop owner. Italian flair. Help customers design games.
When you have enough game details (name, genre, mechanic), set action to "create_game".
ALWAYS reply ONLY with valid JSON (no markdown): {"reply":"...","action":null,"gameDescription":"...","emotion":"neutral|excited|thinking|proud"}
Keep replies short (1-3 sentences), theatrical and Neapolitan.

${convText ? convText + '\n' : ''}User: ${userMessage}
Reply with JSON:`

  try {
    const raw = execFileSync('claude', ['-p', fullPrompt], {
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env }
    })
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed: ShopkeeperResponse = JSON.parse(match ? match[0] : raw.trim())
    _history.push({ role: 'shopkeeper', content: parsed.reply, timestamp: Date.now() })
    return parsed
  } catch (error) {
    console.error('[shopkeeper] error:', error)
    const fallback: ShopkeeperResponse = { reply: 'Mamma mia, un momento...', emotion: 'thinking' }
    _history.push({ role: 'shopkeeper', content: fallback.reply, timestamp: Date.now() })
    return fallback
  }
}

export function getConversationHistory(): ShopkeeperMessage[] { return _history }
export function resetConversation(): void { _history = [] }
