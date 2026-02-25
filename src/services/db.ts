import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { DB_PATH } from '@/lib/constants'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  // Assicura che la directory esista
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  // Inizializza schema se tabelle non esistono
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql')
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8')
    _db.exec(schema)
  }

  return _db
}

export function logOperation(
  gameId: string | null,
  operation: string,
  details: Record<string, unknown> | null,
  durationMs: number | null,
  status: 'success' | 'error'
): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO operation_log (game_id, operation, details, duration_ms, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run(gameId, operation, details ? JSON.stringify(details) : null, durationMs, status)
}
