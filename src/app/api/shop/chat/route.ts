import { NextResponse } from 'next/server'
import { chatWithShopkeeper, getConversationHistory, resetConversation } from '@/services/shopkeeper'
import { getOndeFlowState, endCoderSession, buildCoderBriefing } from '@/services/onde-flow-state'
import { getAppContext, getAppState } from '@/lib/app-registry'
import { execFile } from 'child_process'
import { unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'

function speakAsync(text: string): void {
  const id = randomBytes(8).toString('hex')
  const mp3 = join(tmpdir(), `emilio-${id}.mp3`)
  execFile('/opt/homebrew/bin/edge-tts', [
    '--voice', 'en-US-JennyNeural',
    '--text', text,
    '--write-media', mp3
  ], { timeout: 15000 }, (err) => {
    if (err) return
    execFile('/usr/bin/afplay', [mp3], { timeout: 60000 }, () => {
      try { unlinkSync(mp3) } catch {}
    })
  })
}

export async function POST(request: Request) {
  try {
    const { message, clientAudio } = await request.json()

    if (message === '__reset__') {
      resetConversation()
      return NextResponse.json({ ok: true })
    }

    // Build context for Emilio
    const ofState = getOndeFlowState()
    let combinedContext = ''

    // If Coder was active, inject briefing and transition to Emilio
    if (ofState.mode === 'CODER_ACTIVE') {
      endCoderSession()
      if (ofState.activeApp) {
        const appState = getAppState(ofState.activeApp)
        const briefing = buildCoderBriefing(appState)
        if (briefing) combinedContext += briefing + '\n\n'
      }
    }

    // Inject active app context
    if (ofState.activeApp) {
      try {
        const appCtx = getAppContext(ofState.activeApp)
        if (appCtx) combinedContext += appCtx
      } catch { /* non-fatal */ }
    }

    const response = await chatWithShopkeeper(message, combinedContext || undefined)

    // Play Emilio's reply through Mac speakers (server-side, no browser needed)
    // Skip server-side audio when browser handles it (avoids double-play)
    if (response.reply && !clientAudio) speakAsync(response.reply)

    return NextResponse.json(response)
  } catch (error) {
    console.error('[shop/chat] error:', error)
    return NextResponse.json(
      { reply: 'Errore interno', emotion: 'neutral' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(getConversationHistory())
}
