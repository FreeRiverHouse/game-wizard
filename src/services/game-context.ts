import path from 'node:path'
import { getDb } from './db'
import type { GameRow } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// Active game singleton — persiste nel processo Next.js
// ─────────────────────────────────────────────────────────────────────────────

let _activeGameId: string = process.env.DEFAULT_GAME_ID || 'pgr'

export function getActiveGameId(): string { return _activeGameId }

export function setActiveGameId(id: string): void {
  _activeGameId = id
}

export function getActiveGame(): GameRow | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM games WHERE id = ?').get(_activeGameId) as GameRow | undefined
}

export function getAllGames(): (GameRow & { iteration_count: number; last_iteration_at: string | null; last_pm_summary: string | null })[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      g.*,
      COUNT(i.id)                                           AS iteration_count,
      MAX(i.created_at)                                     AS last_iteration_at,
      (SELECT pm_summary FROM iterations
         WHERE game_id = g.id AND pm_summary IS NOT NULL
         ORDER BY created_at DESC LIMIT 1)                  AS last_pm_summary
    FROM games g
    LEFT JOIN iterations i ON i.game_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all() as any
}

export function getGameStats(gameId: string): {
  totalIterations: number
  doneIterations: number
  totalTokens: number
  recentSummaries: { number: number; pm_summary: string; created_at: string }[]
} {
  const db = getDb()
  const totals = db.prepare(`
    SELECT
      COUNT(*)                      AS totalIterations,
      SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS doneIterations,
      SUM(ai_tokens_used)           AS totalTokens
    FROM iterations WHERE game_id = ?
  `).get(gameId) as any

  const recentSummaries = db.prepare(`
    SELECT number, pm_summary, created_at
    FROM iterations
    WHERE game_id = ? AND pm_summary IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 8
  `).all(gameId) as any

  return {
    totalIterations: totals?.totalIterations || 0,
    doneIterations: totals?.doneIterations || 0,
    totalTokens: totals?.totalTokens || 0,
    recentSummaries,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Path helpers dinamici — usano il gioco attivo dal DB
// ─────────────────────────────────────────────────────────────────────────────

export function getGamePaths(game?: GameRow) {
  const g = game || getActiveGame()
  const gamePath = g?.path || process.env.GAME_PATH || '/Volumes/SSD-FRH-1/Free-River-House/Games/Pizza-Gelato/PizzaGelato-LA-URP'
  return {
    gamePath,
    referenceImage: g?.reference_image || path.join(gamePath, 'references/fly-ride-reference.png'),
    buildersDir: path.join(gamePath, 'Assets/Scripts/Builders'),
    coreDir: path.join(gamePath, 'Assets/Scripts/Core'),
    buildScript: g?.build_script || 'build.sh',
    screenshotScript: g?.screenshot_script || 'screenshot.sh',
  }
}
