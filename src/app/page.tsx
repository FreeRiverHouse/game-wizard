'use client'

import { useState, useCallback, useEffect } from 'react'
import ConsoleOutput from '@/components/ConsoleOutput'
import StatusBadge from '@/components/StatusBadge'
import type { IterationRow } from '@/lib/types'

interface LoopStatusData {
  state: string
  currentIteration: number
  objective: string
  startedAt?: string
}

interface GitStatusData {
  branch: string
  clean: boolean
  modified: string[]
  untracked: string[]
}

function HudCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hud-card bracket-card" style={{ padding: '14px 16px', flex: 1 }}>
      <div className="hud-label" style={{ marginBottom: '10px' }}>{label}</div>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const [lines, setLines] = useState<string[]>([])
  const [cmdStatus, setCmdStatus] = useState<'idle'|'building'|'screenshotting'|'done'|'error'>('idle')
  const [loading, setLoading] = useState(false)
  const [loopStatus, setLoopStatus] = useState<LoopStatusData | null>(null)
  const [lastIteration, setLastIteration] = useState<IterationRow | null>(null)
  const [gitStatus, setGitStatus] = useState<GitStatusData | null>(null)
  const [recentLogs, setRecentLogs] = useState<Array<{id: number; operation: string; status: string | null; duration_ms: number | null; created_at: string}>>([])

  const fetchDashboardData = useCallback(async () => {
    const results = await Promise.allSettled([
      fetch('/api/loop/status').then(r => r.json()),
      fetch('/api/iterations?limit=1').then(r => r.json()),
      fetch('/api/shell/git?action=status').then(r => r.json()),
      fetch('/api/history?limit=5').then(r => r.json()),
    ])

    if (results[0].status === 'fulfilled') setLoopStatus(results[0].value)
    if (results[1].status === 'fulfilled') {
      const data = results[1].value
      setLastIteration(data.iterations?.[0] || null)
    }
    if (results[2].status === 'fulfilled') {
      const data = results[2].value
      if (!data.error) setGitStatus(data)
    }
    if (results[3].status === 'fulfilled') {
      setRecentLogs(Array.isArray(results[3].value) ? results[3].value : [])
    }
  }, [])

  useEffect(() => { fetchDashboardData() }, [fetchDashboardData])

  const runStreamingCommand = useCallback(async (command: 'build' | 'screenshot') => {
    setLines([])
    setCmdStatus(command === 'build' ? 'building' : 'screenshotting')
    setLoading(true)
    const es = new EventSource(`/api/shell/stream?command=${command}`)
    es.addEventListener('stdout', (e) => setLines(prev => [...prev, (e as MessageEvent).data.replace(/^"|"$/g, '')]))
    es.addEventListener('stderr', (e) => setLines(prev => [...prev, `[ERR] ${(e as MessageEvent).data.replace(/^"|"$/g, '')}`]))
    es.addEventListener('done', (e) => {
      setLines(prev => [...prev, `=== ${(e as MessageEvent).data.replace(/^"|"$/g, '')} ===`])
      setCmdStatus('done')
      setLoading(false)
      es.close()
      fetchDashboardData()
    })
    es.onerror = () => { setCmdStatus('error'); setLoading(false); es.close() }
  }, [fetchDashboardData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-bright)' }}>
            DASHBOARD
          </div>
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-dim)', marginTop: '2px' }}>
            PIZZA GELATO RUSH // SELF-IMPROVEMENT LOOP
          </div>
        </div>
        <StatusBadge status={cmdStatus} />
      </div>

      {/* Status Cards */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <HudCard label="◈ LOOP STATUS">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <StatusBadge status={loopStatus?.state || 'idle'} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--cyan)', letterSpacing: '0.05em' }}>
            #{String(loopStatus?.currentIteration || 0).padStart(3, '0')}
          </div>
          {loopStatus?.objective && (
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={loopStatus.objective}>
              {loopStatus.objective}
            </div>
          )}
        </HudCard>

        <HudCard label="◫ LAST ITERATION">
          {lastIteration ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <StatusBadge status={lastIteration.status} />
                {lastIteration.duration_ms && (
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                    {(lastIteration.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--purple)', letterSpacing: '0.05em' }}>
                #{String(lastIteration.number).padStart(3, '0')}
              </div>
              {lastIteration.ai_tokens_used > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px' }}>
                  {lastIteration.ai_tokens_used.toLocaleString()} tokens
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>No iterations yet</div>
          )}
        </HudCard>

        <HudCard label="⎇ GIT STATUS">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <StatusBadge status={gitStatus ? (gitStatus.clean ? 'clean' : 'dirty') : 'idle'} />
          </div>
          {gitStatus ? (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green)', letterSpacing: '0.05em' }}>
                {gitStatus.branch}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px' }}>
                {gitStatus.modified.length > 0 && <span style={{ color: 'var(--amber)' }}>{gitStatus.modified.length} modified  </span>}
                {gitStatus.untracked.length > 0 && <span>{gitStatus.untracked.length} untracked</span>}
                {gitStatus.clean && <span style={{ color: 'var(--green)' }}>working tree clean</span>}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>N/A</div>
          )}
        </HudCard>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => runStreamingCommand('build')}
          disabled={loading}
          className="btn btn-cyan"
        >
          ⬡ BUILD
        </button>
        <button
          onClick={() => runStreamingCommand('screenshot')}
          disabled={loading}
          className="btn btn-cyan"
        >
          ◉ SCREENSHOT
        </button>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="btn btn-ghost"
        >
          ↺ REFRESH
        </button>
      </div>

      {/* Console */}
      <ConsoleOutput lines={lines} maxHeight="280px" />

      {/* Recent Operations */}
      <div>
        <div className="hud-label" style={{ marginBottom: '10px' }}>▸ RECENT OPERATIONS</div>
        {recentLogs.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>— no operations logged —</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {recentLogs.map((log) => (
              <div key={log.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '7px 12px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '3px',
                fontSize: '11px',
              }}>
                <StatusBadge status={log.status || 'idle'} />
                <span style={{ color: 'var(--text-bright)', letterSpacing: '0.05em' }}>{log.operation.toUpperCase()}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '10px' }}>
                  {log.duration_ms ? `${log.duration_ms}ms` : ''}
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: '9px', letterSpacing: '0.05em' }}>
                  {log.created_at}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
