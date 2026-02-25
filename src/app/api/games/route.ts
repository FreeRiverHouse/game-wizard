import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/services/db'
import { getAllGames, getActiveGameId } from '@/services/game-context'

export async function GET() {
  const games = getAllGames()
  const activeId = getActiveGameId()
  return NextResponse.json({ games, activeId })
}

export async function POST(req: NextRequest) {
  const { id, name, path, build_script, screenshot_script, reference_image } = await req.json()

  if (!id || !name || !path) {
    return NextResponse.json({ error: 'id, name, path required' }, { status: 400 })
  }

  const db = getDb()
  try {
    db.prepare(`
      INSERT INTO games (id, name, path, build_script, screenshot_script, reference_image)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      name,
      path,
      build_script || 'build.sh',
      screenshot_script || 'screenshot.sh',
      reference_image || null,
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}
