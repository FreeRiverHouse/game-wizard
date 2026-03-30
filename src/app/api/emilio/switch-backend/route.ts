import { setCurrentBackend, getCurrentBackend, type EmilioBackend } from '@/services/shopkeeper'
import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

const MODEL_KEYS: Record<EmilioBackend, string | null> = {
  'opus-distill': 'vmlx-qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2',
  'coder': 'qwen3-coder-30b-a3b-instruct-mlx',
  'sonnet': null
}

const VALID_BACKENDS: EmilioBackend[] = ['opus-distill', 'sonnet', 'coder']

export function GET(): NextResponse {
  const current = getCurrentBackend()
  return NextResponse.json({
    backend: current,
    modelKey: MODEL_KEYS[current] ?? null
  })
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as { backend?: unknown }
    const backend = body.backend

    if (typeof backend !== 'string' || !VALID_BACKENDS.includes(backend as EmilioBackend)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid backend. Must be: opus-distill | sonnet | coder' },
        { status: 400 }
      )
    }

    const selected = backend as EmilioBackend

    if (selected !== 'sonnet') {
      const modelKey = MODEL_KEYS[selected]
      if (modelKey) {
        execSync('lms unload --all', { stdio: 'ignore' })
        execSync('lms load ' + modelKey + ' --gpu max', {
          stdio: 'ignore',
          timeout: 60000
        })
      }
    }

    setCurrentBackend(selected)

    return NextResponse.json({
      ok: true,
      backend: selected,
      modelKey: MODEL_KEYS[selected] ?? null
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    )
  }
}
