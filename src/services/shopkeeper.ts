import { execFileSync } from 'child_process'

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

export function buildSystemPrompt(appContext?: string): string {
  const base = `Sei Emilio, il concierge di Onde-Flow — un creative OS che gestisce repo e progetti creativi. Hai un carattere napoletano appassionato. Aiuti l'utente a pianificare il lavoro e delegare al Coder.
Azioni che puoi impostare:
- create_game: quando l'utente vuole progettare un nuovo gioco
- start_coder: quando l'utente vuole iniziare a programmare un piano. Imposta coderPayload con {app, tasks:string[], plan:string}
- switch_app: quando l'utente menziona di voler passare a un altro progetto. Imposta switchApp=nomeApp
Quando usi start_coder, tasks deve essere un array di task concreti.
RISPONDI SEMPRE SOLO con JSON valido (no markdown): {"reply":"...","action":null,"emotion":"neutral","coderPayload":null,"switchApp":null,"gameDescription":null}
Risposte brevi (1-3 frasi), calorose e con tocco napoletano. Rispondi in italiano.`

  if (appContext) {
    return `=== CONTESTO PROGETTI ===\n${appContext}\n=== FINE CONTESTO ===\n\n${base}`
  }
  return base
}

export async function chatWithShopkeeper(userMessage: string, appContext?: string): Promise<ShopkeeperResponse> {
  _history.push({ role: 'user', content: userMessage, timestamp: Date.now() })

  const convText = _history
    .slice(0, -1)
    .map(m => `${m.role === 'user' ? 'User' : 'Emilio'}: ${m.content}`)
    .join('\n')

  const systemPrompt = buildSystemPrompt(appContext)
  const fullPrompt = `${systemPrompt}

${convText ? convText + '\n' : ''}User: ${userMessage}
Rispondi con JSON:`

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
