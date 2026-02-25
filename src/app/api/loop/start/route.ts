import { NextResponse } from 'next/server'
import { runIteration, getLoopStatus } from '@/services/loop'

export async function POST(request: Request) {
  const status = getLoopStatus()
  if (status.state !== 'idle') {
    return NextResponse.json({ error: 'Loop already running', state: status.state }, { status: 409 })
  }

  const body = await request.json()
  const options = {
    maxIterations: body.maxIterations || 1,
    continuous: body.continuous || false,
    autoCommit: body.autoCommit || false,
    targetBuilder: body.targetBuilder || undefined,
    objective: body.objective || 'general improvement',
    useLocalAI: body.useLocalAI || false,
  }

  // Fire and forget — il loop gira in background nel processo Node
  runIteration(options).catch(console.error)

  return NextResponse.json({ ok: true, message: 'Loop started', iteration: status.currentIteration + 1 })
}
