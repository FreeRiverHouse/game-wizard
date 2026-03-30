export const dynamic = 'force-dynamic'

const FALLBACK_MESSAGES = [
  "Hey Emilio! How are the projects looking today?",
  "Can you give me an update on the gamestudio?",
  "What about the bookwizard progress?",
  "Can we add some new features to the game?",
  "Let me know if there are any blockers."
]

interface GpMessageRequest {
  context?: string
  step: number
  totalSteps: number
  history: string[]
}

interface GpMessageResponse {
  message: string
  fromLocal: boolean
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as GpMessageRequest
    const { context = '', step, totalSteps, history } = body

    const systemPrompt = `You are Mattia, an indie game developer and creative director. You are talking to Emilio, your AI concierge inside Onde-Flow — a creative OS you built to manage your projects. Your active projects are: "game-studio" (a self-improving AI game loop for Pizza Gelato Rush, a Unity mobile game) and "book-wizard" (an EPUB pipeline for editing and exporting books). You speak casually, in short sentences. You want Emilio to help you check status, plan new features, and eventually send the Coder to work. This is message ${step} of ${totalSteps}. Reply with ONLY your message to Emilio, no explanation, no quotes.`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context ? [{ role: 'user', content: context }] : []),
      ...history.map((h, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: h
      }))
    ]

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: 'meta/llama-3.3-70b-instruct',
          messages,
          temperature: 0.8,
          max_tokens: 100
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`Kimi API error: ${res.status}`)
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>
      }

      const message = data.choices[0]?.message?.content ?? ''

      return Response.json({
        message: message.trim() || FALLBACK_MESSAGES[step % FALLBACK_MESSAGES.length],
        fromLocal: false
      } as GpMessageResponse)
    } catch {
      clearTimeout(timeoutId)
      return Response.json({
        message: FALLBACK_MESSAGES[step % FALLBACK_MESSAGES.length],
        fromLocal: false
      } as GpMessageResponse)
    }
  } catch {
    return Response.json({
      message: FALLBACK_MESSAGES[0],
      fromLocal: false
    } as GpMessageResponse, { status: 500 })
  }
}
