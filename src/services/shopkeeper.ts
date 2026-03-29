import { ensureModel } from './model-orchestrator'

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
  _conversationHistory.push({
    role: 'user',
    content: userMessage,
    timestamp: Date.now()
  })

  try {
    const { url, model } = await ensureModel('planner')
    
    const systemPrompt = `You are Gino, a passionate Neapolitan game shop owner. You speak in a mix of Italian flair and English.
You help customers create video games. When a customer describes a game idea, you get excited and help them
refine it. When you have enough details, respond with action: 'create_game'.

Always respond with valid JSON:
{ "reply": "your dialog text", "action": null | "create_game" | "modify_game" | "show_game",
  "gameDescription": "only if action is create_game - full description", "emotion": "neutral|excited|thinking|proud" }

Keep replies short (1-3 sentences), be expressive and theatrical like a Neapolitan.`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ..._conversationHistory.map(msg => ({ role: msg.role, content: msg.content }))
    ]

    const resp = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 500, temperature: 0.6 }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!resp.ok) throw new Error(`Shopkeeper LLM ${resp.status}`)
    const data = await resp.json()
    let rawText: string = data.choices[0].message.content
    rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    const cleanResult = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

    let parsed: ShopkeeperResponse
    try {
      const jsonMatch = cleanResult.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanResult)
    } catch {
      throw new Error('Failed to parse shopkeeper JSON')
    }

    const shopkeeperReply: ShopkeeperMessage = {
      role: 'shopkeeper',
      content: parsed.reply,
      timestamp: Date.now()
    }

    _conversationHistory.push(shopkeeperReply)

    return parsed
  } catch (error) {
    console.error('Error in chatWithShopkeeper:', error)
    
    const shopkeeperReply: ShopkeeperMessage = {
      role: 'shopkeeper',
      content: "Mamma mia, my brain is not working! Try again.",
      timestamp: Date.now()
    }
    
    _conversationHistory.push(shopkeeperReply)
    
    return {
      reply: "Mamma mia, my brain is not working! Try again.",
      emotion: 'neutral'
    }
  }
}

export function getConversationHistory(): ShopkeeperMessage[] {
  return _conversationHistory
}

export function resetConversation(): void {
  _conversationHistory = []
}