import { spawnBuild, spawnScreenshot } from '@/services/shell'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const command = searchParams.get('command') || 'build'

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const child = command === 'screenshot' ? spawnScreenshot() : spawnBuild()

      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        send('stdout', chunk.toString())
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        send('stderr', chunk.toString())
      })

      child.on('close', (code: number | null) => {
        send('done', `Process exited with code ${code}`)
        controller.close()
      })

      child.on('error', (err: Error) => {
        send('error', err.message)
        controller.close()
      })

      // Abort handler
      request.signal.addEventListener('abort', () => {
        child.kill('SIGTERM')
      })
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
