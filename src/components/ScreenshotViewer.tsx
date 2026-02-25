'use client'

interface Props {
  currentPath?: string
  referencePath?: string
  label?: string
  refreshKey?: number
}

export default function ScreenshotViewer({ currentPath, referencePath, label, refreshKey }: Props) {
  const ts = refreshKey ?? 0

  return (
    <div className="hud-card" style={{ padding: '16px' }}>
      {label && (
        <div className="hud-label" style={{ marginBottom: '12px' }}>{label}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-dim)', marginBottom: '6px' }}>
            ◉ CURRENT
          </div>
          {currentPath ? (
            <img
              src={`/api/image?path=${encodeURIComponent(currentPath)}&t=${ts}`}
              alt="Current screenshot"
              style={{
                width: '100%',
                borderRadius: '3px',
                border: '1px solid var(--cyan-border)',
                objectFit: 'contain',
                display: 'block',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div style={{
              height: '140px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'var(--text-dim)',
            }}>
              NO SCREENSHOT
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-dim)', marginBottom: '6px' }}>
            ◈ REFERENCE TARGET
          </div>
          {referencePath ? (
            <img
              src={`/api/image?path=${encodeURIComponent(referencePath)}`}
              alt="Reference"
              style={{
                width: '100%',
                borderRadius: '3px',
                border: '1px solid var(--purple-border)',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              height: '140px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'var(--text-dim)',
            }}>
              NO REFERENCE
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
