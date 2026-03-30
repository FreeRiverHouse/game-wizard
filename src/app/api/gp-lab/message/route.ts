export const dynamic = 'force-dynamic'

import { execFile } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { chatWithShopkeeper } from '@/services/shopkeeper'

async function playTTSServerSide(text: string): Promise<void> {
  const id = randomBytes(8).toString('hex')
  const mp3 = join(tmpdir(), `gp-${id}.mp3`)
  return new Promise((resolve) => {
    const edgeTts = execFile('/opt/homebrew/bin/edge-tts', [
      '--voice', 'en-US-JennyNeural',
      '--text', text,
      '--write-media', mp3
    ], { timeout: 15000 }, (err) => {
      if (err) { resolve(); return }
      execFile('/usr/bin/afplay', [mp3], { timeout: 30000 }, () => {
        try { unlinkSync(mp3) } catch {}
        resolve()
      })
    })
    void edgeTts
  })
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { message, playAudio = true } = await request.json() as { message: string; playAudio?: boolean }
    if (!message?.trim()) return Response.json({ error: 'no message' }, { status: 400 })

    const result = await chatWithShopkeeper(message.trim())

    // Play audio server-side (no browser needed)
    if (playAudio) {
      void playTTSServerSide(result.reply)
    }

    return Response.json({
      reply: result.reply,
      emotion: result.emotion ?? 'neutral',
      action: result.action ?? null,
      coderPayload: result.coderPayload ?? null,
    })
  } catch (err) {
    console.error('[gp-lab/message]', err)
    return Response.json({ error: 'internal error' }, { status: 500 })
  }
}
