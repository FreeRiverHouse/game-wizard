'use client'

import { useState, useEffect } from 'react'

interface AiStatus {
  local: { online: boolean; url: string; model: string; startCmd: string }
  claude: { available: boolean; strategy: string }
  activeBackend: 'local' | 'claude'
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Record<string, string> | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/game/config').then(r => r.json()).catch(() => null),
      fetch('/api/ai/status').then(r => r.json()).catch(() => null),
    ]).then(([cfg, ai]) => {
      setConfig(cfg)
      setAiStatus(ai)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-zinc-500">Loading settings...</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* ── AI Backend ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-400">AI Backend</h2>
          {aiStatus && (
            <span className={`text-xs px-2 py-0.5 rounded font-mono ${
              aiStatus.activeBackend === 'local'
                ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800'
                : 'bg-purple-900/50 text-purple-400 border border-purple-800'
            }`}>
              {aiStatus.activeBackend === 'local' ? '⚡ LOCAL ACTIVE' : '☁ CLAUDE ACTIVE'}
            </span>
          )}
        </div>

        {/* Local MLX */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${aiStatus?.local.online ? 'bg-green-400' : 'bg-zinc-600'}`} />
            <span className="text-xs font-medium text-zinc-300">
              Local MLX — Qwen3-Coder-30B-A3B
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              aiStatus?.local.online ? 'bg-green-900/40 text-green-400' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {aiStatus?.local.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="text-xs text-zinc-600 ml-4">
            Usato per: generazione codice C# (testo only, gratuito)
          </div>
          {!aiStatus?.local.online && (
            <div className="ml-4 mt-2 bg-zinc-800 rounded p-3 space-y-1">
              <p className="text-xs text-zinc-500">Per avviare il server locale:</p>
              <code className="text-xs text-cyan-400 font-mono block break-all">
                {aiStatus?.local.startCmd}
              </code>
              <p className="text-xs text-zinc-600 mt-1">
                Prima esecuzione: scarica ~15GB automaticamente
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800" />

        {/* Claude */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${aiStatus?.claude.available ? 'bg-purple-400' : 'bg-yellow-500'}`} />
            <span className="text-xs font-medium text-zinc-300">Claude (Anthropic)</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400">
              {aiStatus?.claude.strategy}
            </span>
          </div>
          <div className="text-xs text-zinc-600 ml-4">
            Usato per: analisi screenshot + vision (obbligatorio)
          </div>
        </div>
      </div>

      {/* ── Game Config ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">Game Configuration</h2>

        {[
          { label: 'Game Name', key: 'name' },
          { label: 'Game Path', key: 'path', mono: true },
          { label: 'Build Script', key: 'build_script', mono: true },
          { label: 'Screenshot Script', key: 'screenshot_script', mono: true },
          { label: 'Reference Image', key: 'reference_image', mono: true },
        ].map(({ label, key, mono }) => (
          <div key={key}>
            <label className="text-xs text-zinc-500 block mb-1">{label}</label>
            <div className={`text-sm text-zinc-300 ${mono ? 'font-mono' : ''}`}>
              {config?.[key] || 'N/A'}
            </div>
          </div>
        ))}
      </div>

      {/* ── API Keys ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">API Keys</h2>
        <p className="text-xs text-zinc-600">
          API keys configurate in{' '}
          <code className="text-zinc-400">.env.local</code>.
          Restart dopo modifiche.
        </p>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">ANTHROPIC_API_KEY</label>
          <div className="text-sm text-zinc-300 font-mono">
            {aiStatus?.claude.available ? '✓ Configurata' : 'Non configurata (OAuth/CLI fallback)'}
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">LOCAL_LLM_URL</label>
          <div className="text-sm text-zinc-300 font-mono">{aiStatus?.local.url}</div>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">LOCAL_LLM_MODEL</label>
          <div className="text-sm text-zinc-300 font-mono break-all">{aiStatus?.local.model}</div>
        </div>
      </div>

      {/* ── Builder Files ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Builder Files</h2>
        <p className="text-xs text-zinc-600">
          Builder C# files:{' '}
          <code className="text-zinc-400">{config?.path || ''}/Assets/Scripts/Builders/</code>
        </p>
        <p className="text-xs text-zinc-600">
          Core files:{' '}
          <code className="text-zinc-400">{config?.path || ''}/Assets/Scripts/Core/</code>
        </p>
      </div>
    </div>
  )
}
