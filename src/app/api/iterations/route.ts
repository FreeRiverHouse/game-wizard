import { NextResponse } from 'next/server'
import { getDb } from '@/services/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  const db = getDb()
  const iterations = db.prepare(
    'SELECT * FROM iterations WHERE game_id = ? ORDER BY number DESC LIMIT ? OFFSET ?'
  ).all('pgr', limit, offset)

  const total = (db.prepare('SELECT COUNT(*) as count FROM iterations WHERE game_id = ?').get('pgr') as any)?.count || 0

  return NextResponse.json({ iterations, total })
}
