'use client'

import { useState, useEffect, useRef } from 'react'
import ConsoleOutput from '@/components/ConsoleOutput'
import ScreenshotViewer from '@/components/ScreenshotViewer'
import StatusBadge from '@/components/StatusBadge'
import type { LoopState, AnalysisResult, CodeChange } from '@/lib/types'

export default function LoopPage() {
  const [objective, setObjective] = useState('')
  const [targetBuilder, setTargetBuilder] = useState('')
  const [autoCommit, setAutoCommit] = useState(false)
  const [autonomous, setAutonomous] = useState(false)
  const [maxIterations, setMaxIterations] = useState(1)
  const [continuous, setContinuous] = useState(false)
  const [status, setStatus] = useState<LoopState>('idle')
  const [lines, setLines] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [changes, setChanges] = useState<CodeChange[]>([])
  const [pendingApproval, setPendingApproval] = useState(false)
  const [screenshotRefreshKey, setScreenshotRefreshKey] = useState(0)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/loop/stream')
    esRef.current = es
    es.addEventListener('state', (e) => setStatus(JSON.parse(e.data) as LoopState))
    es.addEventListener('log', (e) => setLines(prev => [...prev, JSON.parse(e.data)]))
    es.addEventListener('analysis', (e) => { try { setAnalysis(JSON.parse(JSON.parse(e.data))) } catch {} })
    es.addEventListener('changes', (e) => { try { setChanges(JSON.parse(JSON.parse(e.data))) } catch {} })
    es.addEventListener('pending_approval', () => setPendingApproval(true))
    es.addEventListener('screenshot', () => setScreenshotRefreshKey(Date.now()))
    return () => { es.close() }
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/loop/status')
        const data = await res.json()
        setStatus(data.state)
        if (data.pendingApproval) setPendingApproval(true)
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const startLoop = async () => {
    setLines([])
    setAnalysis(null)
    setChanges([])
    setPendingApproval(false)
    await fetch('/api/loop/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objective,
        targetBuilder: targetBuilder || undefined,
        autoCommit,
        autonomous,
        maxIterations: continuous ? 999 : maxIterations,
        continuous,
      }),
    })
  }

  const stopLoop = async () => { await fetch('/api/loop/stop', { method: 'POST' }) }

  const approve = async (approved: boolean) => {
    await fetch('/api/loop/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    })
    setPendingApproval(false)
  }

  const isRunning = status !== 'idle'
  const buttonLabel = continuous ? '▶ RUN CONTINUOUS' : maxIterations === 1 ? '▶ RUN 1 ITER' : `▶ RUN ${maxIterations} ITERS`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em' }}>LOOP CONTROL</div>
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-dim)', marginTop: '2px' }}>
            SELF-IMPROVEMENT ENGINE
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Control Panel */}
      <div className="hud-card bracket-card" style={{ padding: '18px' }}>
        <div className="hud-label" style={{ marginBottom: '12px' }}>◈ MISSION OBJECTIVE</div>

        {!autonomous && (
          <textarea
            value={objective}
            onChange={e => setObjective(e.target.value)}
            placeholder="es. migliora i portici — devono essere bianchi puri e più grandi"
            className="hud-input"
            style={{ height: '70px', marginBottom: '12px' }}
          />
        )}

        {autonomous && (
          <div style={{ marginBottom: '12px', fontSize: '10px', color: 'var(--text-mid)', fontStyle: 'italic' }}>
            Planner will auto-generate objectives
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            value={targetBuilder}
            onChange={e => setTargetBuilder(e.target.value)}
            placeholder="Target builder (optional)"
            className="hud-input"
            style={{ flex: 1, minWidth: '180px' }}
          />

          {/* Auto-commit toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>
            <div
              onClick={() => setAutoCommit(v => !v)}
              style={{
                width: 28, height: 16, borderRadius: 8,
                background: autoCommit ? 'var(--green-dim)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${autoCommit ? 'var(--green-border)' : 'var(--border-subtle)'}`,
                position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2,
                left: autoCommit ? 13 : 2,
                width: 10, height: 10, borderRadius: '50%',
                background: autoCommit ? 'var(--green)' : 'var(--text-dim)',
                transition: 'left 0.2s',
              }} />
            </div>
            AUTO-COMMIT
          </label>

          {/* Autonomous toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>
            <div
              onClick={() => setAutonomous(v => !v)}
              style={{
                width: 28, height: 16, borderRadius: 8,
                background: autonomous ? 'var(--cyan-dim)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${autonomous ? 'var(--cyan-border)' : 'var(--border-subtle)'}`,
                position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2,
                left: autonomous ? 13 : 2,
                width: 10, height: 10, borderRadius: '50%',
                background: autonomous ? 'var(--cyan)' : 'var(--text-dim)',
                transition: 'left 0.2s',
              }} />
            </div>
            AUTONOMOUS
          </label>
        </div>

        {/* Iterations row */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-mid)' }}>
            <div
              onClick={() => setContinuous(v => !v)}
              style={{
                width: 28, height: 16, borderRadius: 8,
                background: continuous ? 'var(--cyan-dim)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${continuous ? 'var(--cyan-border)' : 'var(--border-subtle)'}`,
                position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2,
                left: continuous ? 13 : 2,
                width: 10, height: 10, borderRadius: '50%',
                background: continuous ? 'var(--cyan)' : 'var(--text-dim)',
                transition: 'left 0.2s',
              }} />
            </div>
            CONTINUOUS
          </label>

          {!continuous && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-mid)' }}>
              ITERATIONS:
              <input
                type="number"
                min={1} max={20}
                value={maxIterations}
                onChange={e => setMaxIterations(Math.max(1, parseInt(e.target.value) || 1))}
                className="hud-input"
                style={{ width: 56, textAlign: 'center', padding: '4px 8px' }}
              />
            </label>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={startLoop}
            disabled={isRunning || (!autonomous && !objective.trim())}
            className="btn btn-green"
          >
            {buttonLabel}
          </button>
          <button
            onClick={stopLoop}
            disabled={!isRunning}
            className="btn btn-red"
          >
            ■ STOP
          </button>
        </div>
      </div>

      {/* Screenshots */}
      <ScreenshotViewer
        currentPath="/tmp/pgr_zoom.png"
        referencePath="/Users/mattiapetrucciani/pizza-gelato-rush/references/fly-ride-reference.png"
        label="VISUAL COMPARISON"
        refreshKey={screenshotRefreshKey}
      />

      {/* AI Analysis */}
      {analysis && (
        <div className="hud-card" style={{ padding: '16px' }}>
          <div className="hud-label" style={{ marginBottom: '10px' }}>◈ AI ANALYSIS</div>
          <div style={{ fontSize: '12px', color: 'var(--text-bright)', marginBottom: '10px', lineHeight: 1.6 }}>
            {analysis.summary}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {analysis.gaps.map((gap, i) => (
              <div key={i} style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '3px',
                padding: '8px 10px',
                fontSize: '10px',
              }}>
                <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{gap.element}</span>
                <span style={{ color: 'var(--text-dim)' }}> — </span>
                <span style={{ color: 'var(--red)' }}>{gap.current}</span>
                <span style={{ color: 'var(--text-dim)' }}> → </span>
                <span style={{ color: 'var(--green)' }}>{gap.target}</span>
                <div style={{ color: 'var(--text-mid)', marginTop: '4px' }}>↳ {gap.fix}</div>
              </div>
            ))}
          </div>
          {analysis.suggestedFiles.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
              FILES: {analysis.suggestedFiles.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* Pending Changes */}
      {changes.length > 0 && (
        <div className="hud-card" style={{ padding: '16px', borderColor: pendingApproval ? 'var(--amber)' : 'var(--cyan-border)' }}>
          <div className="hud-label" style={{ marginBottom: '10px', color: pendingApproval ? 'var(--amber)' : undefined }}>
            {pendingApproval ? '⚠ AWAITING APPROVAL' : '▸ PROPOSED CHANGES'} ({changes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {changes.map((ch, i) => (
              <div key={i} style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '3px',
                padding: '8px 10px',
                fontFamily: 'inherit',
                fontSize: '10px',
              }}>
                <div style={{ color: 'var(--text-dim)', marginBottom: '4px', fontSize: '9px' }}>
                  {ch.filePath} — {ch.description}
                </div>
                <div style={{ color: 'var(--red)', opacity: 0.85 }}>- {ch.oldCode.slice(0, 140)}</div>
                <div style={{ color: 'var(--green)' }}>+ {ch.newCode.slice(0, 140)}</div>
              </div>
            ))}
          </div>
          {pendingApproval && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => approve(true)} className="btn btn-green">✓ APPROVE & COMMIT</button>
              <button onClick={() => approve(false)} className="btn btn-red">✗ REJECT</button>
            </div>
          )}
        </div>
      )}

      {/* Console */}
      <ConsoleOutput lines={lines} maxHeight="280px" />
    </div>
  )
}