import { addLoopListener, removeLoopListener, getLoopStatus } from '@/services/loop'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()

  let keepalive: ReturnType<typeof setInterval> | null = null
  let listener: ((event: string, data: string) => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: string) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Controller already closed
        }
      }

      // Manda stato corrente subito alla connessione
      const status = getLoopStatus()
      send('state', status.state)

      listener = (event: string, data: string) => send(event, data)
      addLoopListener(listener)

      // Keepalive ogni 15 secondi
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          if (keepalive) clearInterval(keepalive)
          if (listener) removeLoopListener(listener)
        }
      }, 15_000)
    },
    cancel() {
      // Cleanup quando il client si disconnette
      if (keepalive) {
        clearInterval(keepalive)
        keepalive = null
      }
      if (listener) {
        removeLoopListener(listener)
        listener = null
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
