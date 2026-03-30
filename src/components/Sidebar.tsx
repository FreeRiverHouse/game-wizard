'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { href: '/emilio',    label: 'EMILIO',    icon: '~' },
  { href: '/games',     label: 'GAMES',     icon: '⊞' },
  { href: '/',          label: 'DASHBOARD', icon: '◈' },
  { href: '/loop',      label: 'LOOP',      icon: '⟳' },
  { href: '/builders',  label: 'BUILDERS',  icon: '⬡' },
  { href: '/history',   label: 'HISTORY',   icon: '◫' },
  { href: '/settings',  label: 'SETTINGS',  icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [activeGame, setActiveGame] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    fetch('/api/games')
      .then(r => r.json())
      .then(data => {
        const active = data.games?.find((g: any) => g.id === data.activeId)
        if (active) setActiveGame({ id: active.id, name: active.name })
      })
      .catch(() => {})
  }, [pathname]) // ricarica quando cambia pagina (dopo activate)

  return (
    <aside style={{
      width: '200px',
      minWidth: '200px',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--cyan-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Top glow line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, var(--cyan), transparent)',
        opacity: 0.6,
      }} />

      {/* Logo */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.25em',
          color: 'var(--cyan)',
          textShadow: '0 0 12px rgba(0,212,255,0.6)',
        }}>
          ONDE-FLOW
        </div>
        <div style={{
          fontSize: '9px',
          letterSpacing: '0.3em',
          color: 'var(--text-dim)',
          marginTop: '3px',
        }}>
          CREATIVE OS // v3.0
        </div>
      </div>

      {/* Active game chip */}
      {activeGame && (
        <Link href="/games" style={{ textDecoration: 'none' }}>
          <div style={{
            margin: '8px 10px 0',
            padding: '6px 10px',
            background: 'rgba(0,212,255,0.06)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: '4px',
            cursor: 'pointer',
          }}>
            <div style={{ fontSize: '8px', letterSpacing: '0.15em', color: 'var(--text-dim)' }}>
              ACTIVE GAME
            </div>
            <div style={{
              fontSize: '11px', fontWeight: 600,
              color: 'var(--cyan)', letterSpacing: '0.05em',
              marginTop: '2px', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {activeGame.name.toUpperCase()}
            </div>
          </div>
        </Link>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? ' nav-active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 16px',
                fontSize: '10px',
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.12em',
                color: active ? 'var(--cyan)' : 'var(--text-dim)',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: '14px', opacity: active ? 1 : 0.5, lineHeight: 1 }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom status bar */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '9px',
        letterSpacing: '0.1em',
        color: 'var(--text-dim)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: 'var(--green)', animation: 'pulse-dot 1.2s ease-in-out infinite',
          }} />
          SYSTEM ONLINE
        </div>
        {activeGame && (
          <div style={{ marginTop: '4px', opacity: 0.5 }}>
            {activeGame.id.toUpperCase()}
          </div>
        )}
      </div>
    </aside>
  )
}
