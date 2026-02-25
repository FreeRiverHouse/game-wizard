'use client'

import { useRef, useEffect } from 'react'

interface Props {
  lines: string[]
  maxHeight?: string
}

function colorLine(line: string): string {
  if (line.startsWith('[ERR]') || line.includes('ERROR') || line.includes('failed')) return 'var(--red)'
  if (line.startsWith('===') || line.startsWith('---')) return 'var(--cyan)'
  if (line.includes('OK') || line.includes('COMPLETE') || line.includes('Committed')) return 'var(--green)'
  if (line.includes('WARNING') || line.includes('⚠')) return 'var(--amber)'
  if (line.includes('[') && line.includes('/5]')) return 'var(--purple)'
  if (line.includes('Analysis') || line.includes('Generated') || line.includes('Summary')) return '#a5b4fc'
  return 'rgba(148,163,184,0.85)'
}

export default function ConsoleOutput({ lines, maxHeight = '300px' }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div style={{
      background: 'rgba(0,0,0,0.6)',
      border: '1px solid var(--cyan-border)',
      borderRadius: '4px',
      padding: '12px 14px',
      fontFamily: 'inherit',
      fontSize: '11px',
      lineHeight: '1.7',
      overflowY: 'auto',
      maxHeight,
      position: 'relative',
    }}>
      {/* Top label */}
      <div style={{
        position: 'absolute',
        top: '-1px', left: '12px',
        background: 'var(--bg-void)',
        padding: '0 6px',
        fontSize: '8px',
        letterSpacing: '0.2em',
        color: 'var(--cyan)',
        opacity: 0.7,
      }}>
        CONSOLE
      </div>

      {lines.length === 0 && (
        <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
          {'> '}awaiting input...
          <span style={{ animation: 'pulse-dot 1s step-end infinite', display: 'inline-block', marginLeft: 2 }}>█</span>
        </div>
      )}
      {lines.map((line, i) => (
        <div key={i} style={{ color: colorLine(line), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <span style={{ color: 'var(--text-dim)', marginRight: '8px', userSelect: 'none', fontSize: '9px' }}>
            {String(i + 1).padStart(3, '0')}
          </span>
          {line}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
