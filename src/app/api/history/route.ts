import { NextResponse } from 'next/server'
import { getDb } from '@/services/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')

  const db = getDb()
  const logs = db.prepare(
    `SELECT * FROM operation_log ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(limit, offset)

  return NextResponse.json(logs)
}
