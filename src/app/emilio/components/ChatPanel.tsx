'use client'

import { useRef, useEffect } from 'react'

type EmilioBackend = 'opus-distill' | 'sonnet' | 'coder'

interface ChatPanelProps {
  messages: Array<{ role: 'user' | 'shopkeeper' | 'system' | 'bot'; content: string; emotion?: string }>
  isLoading: boolean
  inputValue: string
  onInputChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onReset: () => void
  activeApp: string | null
  ondeFlowMode: 'EMILIO_ACTIVE' | 'CODER_ACTIVE' | 'IDLE'
  currentBackend: EmilioBackend
  onSwitchBackend: (b: EmilioBackend) => void
  isSwitchingBackend: boolean
  isGPRunning: boolean
  gpStep: number
  gpTotal: number
  onRunGP: () => void
  onStopGP: () => void
  isVoiceRecording?: boolean
  isVoiceProcessing?: boolean
  onToggleVoice?: () => void
}

export default function ChatPanel({
  messages,
  isLoading,
  inputValue,
  onInputChange,
  onSubmit,
  onReset,
  activeApp,
  ondeFlowMode,
  currentBackend,
  onSwitchBackend,
  isSwitchingBackend,
  isGPRunning,
  gpStep,
  gpTotal,
  onRunGP,
  onStopGP,
  isVoiceRecording = false,
  isVoiceProcessing = false,
  onToggleVoice
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const modeBadge = () => {
    if (ondeFlowMode === 'EMILIO_ACTIVE') {
      return <span style={{ color: '#00ff9f', fontSize: 11 }}>● EMILIO</span>
    }
    if (ondeFlowMode === 'CODER_ACTIVE') {
      return <span style={{ color: '#ffaa00', fontSize: 11 }}>● CODER</span>
    }
    return <span style={{ color: '#64748b', fontSize: 11 }}>● IDLE</span>
  }

  const backendPill = (label: string, backend: EmilioBackend) => {
    const isActive = currentBackend === backend
    return (
      <button
        onClick={() => onSwitchBackend(backend)}
        disabled={isSwitchingBackend}
        style={{
          background: isActive ? 'rgba(0,212,255,0.2)' : 'transparent',
          border: isActive ? '1px solid #00d4ff' : '1px solid rgba(0,212,255,0.2)',
          color: isActive ? '#00d4ff' : 'rgba(0,212,255,0.4)',
          fontSize: 9,
          padding: '2px 6px',
          borderRadius: 4,
          cursor: isSwitchingBackend ? 'not-allowed' : 'pointer',
          fontFamily: 'monospace',
          marginRight: 4,
          opacity: isSwitchingBackend ? 0.5 : 1
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ width: '40%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#07071a', borderLeft: '1px solid rgba(0,212,255,0.2)', fontFamily: 'monospace', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,212,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            {backendPill('OPUS', 'opus-distill')}
            {backendPill('SONNET', 'sonnet')}
            {backendPill('CODER', 'coder')}
          </div>
          <div style={{ color: '#00d4ff', fontSize: 11, letterSpacing: 2 }}>EMILIO // ONDE-FLOW</div>
          {activeApp && (
            <div style={{ display: 'inline-block', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 4, fontSize: 10, padding: '2px 8px', marginTop: 4, color: '#00d4ff' }}>
              {activeApp}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={isGPRunning ? onStopGP : onRunGP}
            style={{
              background: 'transparent',
              border: `1px solid ${isGPRunning ? '#ff4444' : 'rgba(0,212,255,0.3)'}`,
              color: isGPRunning ? '#ff4444' : 'rgba(0,212,255,0.7)',
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'monospace'
            }}
          >
            {isGPRunning ? `🐹 ${gpStep}/${gpTotal}` : '🐹 GP'}
          </button>
          {modeBadge()}
        </div>
      </div>

      {/* Switching Banner */}
      {isSwitchingBackend && (
        <div style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', fontSize: 11, padding: '8px 16px', textAlign: 'center' }}>
          ⏳ Cambio modello in corso...
        </div>
      )}

      {/* Coder Banner */}
      {ondeFlowMode === 'CODER_ACTIVE' && (
        <div style={{ background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', color: '#ffaa00', fontSize: 11, padding: '8px 16px', textAlign: 'center' }}>
          ⚡ CODER ACTIVE
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} style={{ alignSelf: 'flex-end', background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', fontSize: 13, color: '#e2e8f0', maxWidth: '80%' }}>
                {m.content}
              </div>
            )
          }
          if (m.role === 'shopkeeper') {
            return (
              <div key={i} style={{ alignSelf: 'flex-start', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: '2px 12px 12px 12px', padding: '8px 12px', fontSize: 13, color: '#e2e8f0', maxWidth: '85%' }}>
                {m.content}
              </div>
            )
          }
          if (m.role === 'bot') {
            return (
              <div key={i} style={{ alignSelf: 'flex-end', background: 'rgba(168,85,247,0.1)', border: '1px dashed rgba(168,85,247,0.5)', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', fontSize: 13, color: '#c4b5fd', maxWidth: '80%' }}>
                {m.content}
              </div>
            )
          }
          return (
            <div key={i} style={{ alignSelf: 'center', color: 'rgba(0,255,159,0.7)', fontSize: 11, fontStyle: 'italic' }}>
              {m.content}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,212,255,0.15)' }}>
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
          {onToggleVoice && (
            <button
              type="button"
              onClick={onToggleVoice}
              style={{
                background: isVoiceRecording ? 'rgba(255,50,50,0.2)' : isVoiceProcessing ? 'rgba(255,170,0,0.15)' : 'rgba(0,212,255,0.05)',
                border: `1px solid ${isVoiceRecording ? '#ff3232' : isVoiceProcessing ? '#ffaa00' : 'rgba(0,212,255,0.3)'}`,
                color: isVoiceRecording ? '#ff3232' : isVoiceProcessing ? '#ffaa00' : 'rgba(0,212,255,0.7)',
                borderRadius: 6, padding: '8px 10px', fontSize: 15, cursor: 'pointer',
                animation: isVoiceRecording ? 'pulse 1s infinite' : 'none'
              }}
            >
              {isVoiceProcessing ? '⏳' : isVoiceRecording ? '🔴' : '🎙'}
            </button>
          )}
          <input
            type="text"
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            placeholder={isVoiceRecording ? '● Recording...' : isVoiceProcessing ? 'Processing...' : 'Talk to Emilio...'}
            disabled={isLoading}
            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: `1px solid ${isVoiceRecording ? 'rgba(255,50,50,0.4)' : 'rgba(0,212,255,0.3)'}`, borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{ background: '#00d4ff', color: '#02020c', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
          >
            INVIA
          </button>
          <button
            type="button"
            onClick={onReset}
            style={{ background: 'transparent', color: 'rgba(0,212,255,0.5)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 6, padding: '8px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            RESET
          </button>
        </form>
      </div>
    </div>
  )
}
