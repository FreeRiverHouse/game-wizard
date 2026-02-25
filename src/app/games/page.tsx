'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface GameCard {
  id: string
  name: string
  path: string
  created_at: string
  iteration_count: number
  last_iteration_at: string | null
  last_pm_summary: string | null
}

interface RecentSummary {
  number: number
  pm_summary: string
  created_at: string
}

interface GameDetail {
  stats: {
    totalIterations: number
    doneIterations: number
    totalTokens: number
    recentSummaries: RecentSummary[]
  }
}

// ── Add Game Form ──────────────────────────────────────────────────────────

function AddGameForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ id: '', name: '', path: '', reference_image: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setErr(data.error); return }
    setOpen(false)
    setForm({ id: '', name: '', path: '', reference_image: '' })
    onAdded()
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="btn btn-ghost" style={{ fontSize: '11px' }}>
      + ADD GAME
    </button>
  )

  return (
    <form onSubmit={submit} style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxWidth: '480px',
    }}>
      <div className="hud-label">◈ NEW GAME</div>
      {[
        { key: 'name', label: 'Name', placeholder: 'My Racing Game' },
        { key: 'id', label: 'ID (slug)', placeholder: 'my-racing-game' },
        { key: 'path', label: 'Game Path', placeholder: '/Users/you/my-game' },
        { key: 'reference_image', label: 'Reference Image (optional)', placeholder: '/path/to/reference.png' },
      ].map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="hud-label" style={{ fontSize: '9px', marginBottom: '4px', display: 'block' }}>{label}</label>
          <input
            className="input-hud"
            placeholder={placeholder}
            value={(form as any)[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            required={key !== 'reference_image'}
            style={{ width: '100%', padding: '8px 12px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
          />
        </div>
      ))}
      {err && <div style={{ color: 'var(--red)', fontSize: '11px' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={saving} className="btn btn-cyan" style={{ fontSize: '11px' }}>
          {saving ? 'SAVING...' : '✓ CREATE'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ fontSize: '11px' }}>
          CANCEL
        </button>
      </div>
    </form>
  )
}

// ── Game Card ─────────────────────────────────────────────────────────────

function GameCardComponent({
  game, isActive, onActivate,
}: {
  game: GameCard
  isActive: boolean
  onActivate: () => void
}) {
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function loadDetail() {
    if (detail) { setExpanded(e => !e); return }
    const res = await fetch(`/api/games/${game.id}`)
    const data = await res.json()
    setDetail(data)
    setExpanded(true)
  }

  const lastIter = game.last_iteration_at
    ? new Date(game.last_iteration_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
    : null

  return (
    <div style={{
      background: isActive ? 'rgba(0,212,255,0.05)' : 'var(--bg-panel)',
      border: `1px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
      borderRadius: '6px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'border-color 0.15s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)', letterSpacing: '0.05em' }}>
              {game.name.toUpperCase()}
            </span>
            {isActive && (
              <span style={{
                fontSize: '9px', padding: '1px 6px', borderRadius: '2px',
                background: 'var(--cyan)', color: '#000', fontWeight: 700, letterSpacing: '0.1em',
              }}>ACTIVE</span>
            )}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            {game.id}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {!isActive && (
            <button onClick={onActivate} className="btn btn-cyan" style={{ fontSize: '10px', padding: '4px 10px' }}>
              ACTIVATE
            </button>
          )}
          <button onClick={loadDetail} className="btn btn-ghost" style={{ fontSize: '10px', padding: '4px 10px' }}>
            {expanded ? '▲ HIDE' : '▼ HISTORY'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '20px' }}>
        <div>
          <div className="hud-label" style={{ fontSize: '8px' }}>ITERATIONS</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--cyan)', lineHeight: 1.2 }}>
            {String(game.iteration_count).padStart(3, '0')}
          </div>
        </div>
        {lastIter && (
          <div>
            <div className="hud-label" style={{ fontSize: '8px' }}>LAST RUN</div>
            <div style={{ fontSize: '13px', color: 'var(--text-bright)', marginTop: '4px' }}>{lastIter}</div>
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div className="hud-label" style={{ fontSize: '8px' }}>PATH</div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {game.path}
          </div>
        </div>
      </div>

      {/* Last summary */}
      {game.last_pm_summary && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--bg-deep)',
          borderLeft: '2px solid var(--purple)',
          borderRadius: '0 3px 3px 0',
          fontSize: '11px',
          color: 'var(--text-mid)',
          lineHeight: 1.5,
        }}>
          <span style={{ color: 'var(--purple)', fontSize: '9px', letterSpacing: '0.1em', display: 'block', marginBottom: '2px' }}>◈ LAST CHANGE</span>
          {game.last_pm_summary}
        </div>
      )}

      {/* Expanded history */}
      {expanded && detail && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="hud-label" style={{ fontSize: '9px', marginBottom: '4px' }}>▸ RECENT ITERATIONS</div>
          {detail.stats.recentSummaries.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>— no summaries yet —</div>
          ) : detail.stats.recentSummaries.map((s) => (
            <div key={s.number} style={{
              display: 'flex', gap: '10px', alignItems: 'flex-start',
              padding: '6px 10px',
              background: 'var(--bg-deep)',
              borderRadius: '3px',
              fontSize: '11px',
            }}>
              <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '32px' }}>
                #{String(s.number).padStart(3, '0')}
              </span>
              <span style={{ color: 'var(--text-mid)', lineHeight: 1.4, flex: 1 }}>{s.pm_summary}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: '9px', whiteSpace: 'nowrap' }}>
                {new Date(s.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '20px', marginTop: '4px', fontSize: '10px', color: 'var(--text-dim)' }}>
            <span>Total: <b style={{ color: 'var(--text-bright)' }}>{detail.stats.totalIterations}</b> iters</span>
            <span>Done: <b style={{ color: 'var(--green)' }}>{detail.stats.doneIterations}</b></span>
            <span>Tokens: <b style={{ color: 'var(--text-bright)' }}>{detail.stats.totalTokens?.toLocaleString()}</b></span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function GamesPage() {
  const router = useRouter()
  const [games, setGames] = useState<GameCard[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  async function loadGames() {
    const res = await fetch('/api/games')
    const data = await res.json()
    setGames(data.games || [])
    setActiveId(data.activeId || '')
    setLoading(false)
  }

  useEffect(() => { loadGames() }, [])

  async function activate(id: string) {
    await fetch(`/api/games/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activate: true }),
    })
    setActiveId(id)
    router.push('/dashboard')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-bright)' }}>
            GAMES
          </div>
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-dim)', marginTop: '2px' }}>
            MULTI-GAME PROJECT MANAGER
          </div>
        </div>
        <AddGameForm onAdded={loadGames} />
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Loading games...</div>
      ) : games.length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>No games yet. Add one above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {games.map(g => (
            <GameCardComponent
              key={g.id}
              game={g}
              isActive={g.id === activeId}
              onActivate={() => activate(g.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
