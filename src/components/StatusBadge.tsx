interface Props {
  status: string
}

type StatusConfig = { color: string; bg: string; border: string; pulse: boolean }

const STATUS_MAP: Record<string, StatusConfig> = {
  idle:          { color: 'var(--text-dim)',  bg: 'transparent',       border: 'var(--border-subtle)', pulse: false },
  building:      { color: 'var(--amber)',     bg: 'var(--amber-dim)',   border: 'rgba(251,191,36,0.3)', pulse: true  },
  screenshotting:{ color: 'var(--cyan)',      bg: 'var(--cyan-dim)',    border: 'var(--cyan-border)',   pulse: true  },
  analyzing:     { color: 'var(--purple)',    bg: 'var(--purple-dim)',  border: 'var(--purple-border)', pulse: true  },
  modifying:     { color: 'var(--amber)',     bg: 'var(--amber-dim)',   border: 'rgba(251,191,36,0.3)', pulse: true  },
  committing:    { color: 'var(--green)',     bg: 'var(--green-dim)',   border: 'var(--green-border)',  pulse: true  },
  done:          { color: 'var(--green)',     bg: 'var(--green-dim)',   border: 'var(--green-border)',  pulse: false },
  success:       { color: 'var(--green)',     bg: 'var(--green-dim)',   border: 'var(--green-border)',  pulse: false },
  error:         { color: 'var(--red)',       bg: 'var(--red-dim)',     border: 'var(--red-border)',    pulse: false },
  failed:        { color: 'var(--red)',       bg: 'var(--red-dim)',     border: 'var(--red-border)',    pulse: false },
  dirty:         { color: 'var(--amber)',     bg: 'var(--amber-dim)',   border: 'rgba(251,191,36,0.3)', pulse: false },
  clean:         { color: 'var(--green)',     bg: 'var(--green-dim)',   border: 'var(--green-border)',  pulse: false },
}

export default function StatusBadge({ status }: Props) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.idle
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      fontSize: '9px',
      fontWeight: 600,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: '2px',
    }}>
      <span style={{
        display: 'inline-block',
        width: 5, height: 5,
        borderRadius: '50%',
        background: cfg.color,
        animation: cfg.pulse ? 'pulse-dot 1s ease-in-out infinite' : undefined,
      }} />
      {status}
    </span>
  )
}
