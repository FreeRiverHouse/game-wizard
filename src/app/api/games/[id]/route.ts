import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/services/db'
import { setActiveGameId, getGameStats } from '@/services/game-context'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(params.id)
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

  const stats = getGameStats(params.id)
  return NextResponse.json({ game, stats })
}

// PATCH /api/games/[id] — imposta gioco attivo o aggiorna dati
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))

  const db = getDb()
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(params.id)
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

  if (body.activate) {
    setActiveGameId(params.id)
    return NextResponse.json({ ok: true, activeId: params.id })
  }

  // Update game fields
  const allowed = ['name', 'path', 'build_script', 'screenshot_script', 'reference_image']
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )
  if (Object.keys(updates).length > 0) {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE games SET ${sets} WHERE id = ?`)
      .run(...Object.values(updates), params.id)
  }

  return NextResponse.json({ ok: true })
}
