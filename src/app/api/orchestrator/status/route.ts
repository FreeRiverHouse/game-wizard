import { NextResponse } from 'next/server'
import { getOrchestratorStatus } from '@/services/model-orchestrator'
import { getLoopStatus } from '@/services/loop'

export const dynamic = 'force-dynamic'

export async function GET() {
  const orch = getOrchestratorStatus()
  const loop = getLoopStatus()

  return NextResponse.json({
    orchestrator: orch,
    loop: {
      state: loop.state,
      iteration: loop.currentIteration,
      objective: loop.objective,
    },
    // Flat pipeline view for the shop UI
    pipeline: {
      gino:    { status: 'ready',              label: 'Gino',    desc: 'Claude Sonnet (API)' },
      planner: { status: orch.pipeline.planner, label: 'Planner', desc: 'Qwen3.5 27B' },
      coder:   { status: orch.pipeline.coder,   label: 'Coder',   desc: 'Qwen3-Coder 30B' },
      vision:  { status: orch.pipeline.vision,  label: 'Vision',  desc: 'Qwen2.5-VL 7B' },
    },
    detail: orch.detail,
  })
}
