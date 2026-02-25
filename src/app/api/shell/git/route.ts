import { NextResponse } from 'next/server'
import { runGitStatus, runGitLog, runGitCommit, runGitPush, runGitDiff } from '@/services/shell'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'status'

  try {
    switch (action) {
      case 'status':
        return NextResponse.json(await runGitStatus())
      case 'log': {
        const count = parseInt(searchParams.get('count') || '10')
        return NextResponse.json(await runGitLog(undefined, count))
      }
      case 'diff': {
        const staged = searchParams.get('staged') === 'true'
        return NextResponse.json({ diff: await runGitDiff(undefined, staged) })
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { action, files, message } = body

  try {
    switch (action) {
      case 'commit':
        if (!files || !message) {
          return NextResponse.json({ error: 'files and message required' }, { status: 400 })
        }
        return NextResponse.json(await runGitCommit(files, message))
      case 'push':
        return NextResponse.json(await runGitPush())
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
