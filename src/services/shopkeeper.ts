import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ShopkeeperMessage {
  role: 'user' | 'shopkeeper' | 'system'
  content: string
  timestamp: number
}

export interface ShopkeeperResponse {
  reply: string
  action?: 'create_game' | 'modify_game' | 'show_game' | null
  gameDescription?: string
  emotion?: 'neutral' | 'excited' | 'thinking' | 'proud'
}

let _conversationHistory: ShopkeeperMessage[] = []

export async function chatWithShopkeeper(userMessage: string): Promise<ShopkeeperResponse> {
  _conversationHistory.push({ role: 'user', content: userMessage, timestamp: Date.now() })
  try {
    const systemPrompt = `You are Gino, a passionate Neapolitan game shop owner. You speak with Italian flair and help customers design video games. When you have enough details about a game idea, respond with action: create_game. Always respond ONLY with valid JSON: { "reply": "your dialog", "action": null or "create_game" or "modify_game" or "show_game", "gameDescription": "only if action is create_game", "emotion": "neutral" or "excited" or "thinking" or "proud" }. Keep replies short (1-3 sentences), theatrical and Neapolitan.`

    const messages = _conversationHistory
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: (msg.role === 'shopkeeper' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: msg.content
      }))

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      system: systemPrompt,
      messages,
      max_tokens: 500,
      temperature: 0.6
    })

    const textBlock = response.content.find(b => b.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''
    const cleanResult = rawText.trim()

    let parsed: ShopkeeperResponse
    try {
      const jsonMatch = cleanResult.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanResult)
    } catch {
      throw new Error('Failed to parse shopkeeper JSON')
    }

    _conversationHistory.push({ role: 'shopkeeper', content: parsed.reply, timestamp: Date.now() })
    return parsed
  } catch (error) {
    console.error('Error in chatWithShopkeeper:', error)
    _conversationHistory.push({ role: 'shopkeeper', content: 'Mamma mia, my brain is not working! Try again.', timestamp: Date.now() })
    return { reply: 'Mamma mia, my brain is not working! Try again.', emotion: 'neutral' }
  }
}

export function getConversationHistory(): ShopkeeperMessage[] { return _conversationHistory }
export function resetConversation(): void { _conversationHistory = [] }
