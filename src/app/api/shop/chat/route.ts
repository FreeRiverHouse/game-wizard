import { NextResponse } from 'next/server'
import { chatWithShopkeeper, getConversationHistory, resetConversation } from '@/services/shopkeeper'
import { getOndeFlowState, endCoderSession, buildCoderBriefing } from '@/services/onde-flow-state'
import { getAppContext, getAppState } from '@/lib/app-registry'

export async function POST(request: Request) {
  try {
    const { message } = await request.json()

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
