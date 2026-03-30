export const dynamic = 'force-dynamic'

const WHISPER_PORT = 8178

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) return Response.json({ error: 'no audio' }, { status: 400 })

    const arrayBuffer = await audioFile.arrayBuffer()

    // Forward to local Whisper server (onde-vibe)
    const whisperForm = new FormData()
    whisperForm.append('file', new Blob([arrayBuffer], { type: 'audio/wav' }), 'audio.wav')
    whisperForm.append('response_format', 'json')

    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 30000)

    try {
      const res = await fetch(`http://127.0.0.1:${WHISPER_PORT}/inference`, {
        method: 'POST',
        body: whisperForm,
        signal: controller.signal,
      })
      clearTimeout(tid)

      if (!res.ok) return Response.json({ error: 'whisper error', status: res.status }, { status: 502 })

      const data = await res.json() as { text: string }
      return Response.json({ text: data.text ?? '' })
    } catch {
      clearTimeout(tid)
      return Response.json({ error: 'whisper offline' }, { status: 503 })
    }
  } catch {
    return Response.json({ error: 'invalid request' }, { status: 400 })
  }
}
