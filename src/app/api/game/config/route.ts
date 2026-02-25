import { NextResponse } from 'next/server'
import { getDb } from '@/services/db'

export async function GET() {
  const db = getDb()
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get('pgr')
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }
  return NextResponse.json(game)
}
