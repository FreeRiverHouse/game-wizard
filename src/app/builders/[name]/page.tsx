'use client'

import { useState, useEffect, use } from 'react'
import type { BuilderInfo, BuilderParam } from '@/lib/types'

function ColorPreview({ value }: { value: string }) {
  // Parse "0.96f, 0.50f, 0.12f" → rgb(r, g, b)
  const parts = value.replace(/f/g, '').split(',').map(s => parseFloat(s.trim()))
  if (parts.length < 3 || parts.some(isNaN)) return null
  const r = Math.round(Math.min(1, parts[0]) * 255)
  const g = Math.round(Math.min(1, parts[1]) * 255)
  const b = Math.round(Math.min(1, parts[2]) * 255)
  return (
    <span
      className="inline-block w-6 h-6 rounded border border-zinc-700 flex-shrink-0"
      style={{ backgroundColor: `rgb(${r},${g},${b})` }}
      title={`rgb(${r}, ${g}, ${b})`}
    />
  )
}

function ParamEditor({
  builderName,
  param,
  onUpdate,
}: {
  builderName: string
  param: BuilderParam
  onUpdate: (param: BuilderParam) => void
}) {
  const [value, setValue] = useState(param.value)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const changed = value !== param.value

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/builders/${builderName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramName: param.name, newValue: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error || 'Save failed')
      } else {
        const updatedParam = data.params?.find((p: BuilderParam) => p.name === param.name)
        if (updatedParam) onUpdate(updatedParam)
      }
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-800/50">
      <div className="w-44 flex-shrink-0">
        <span className="text-sm text-white">{param.name}</span>
        <span className="text-xs text-zinc-600 ml-1.5">L{param.line}</span>
      </div>
      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 flex-shrink-0 w-14 text-center">
        {param.type}
      </span>
      {param.type === 'Color' && <ColorPreview value={value} />}
      <input
        value={value}
        onChange={e => { setValue(e.target.value); setSaveError(null) }}
        className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm font-mono text-zinc-300 focus:border-zinc-500 outline-none"
      />
      {changed && (
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-xs flex-shrink-0"
        >
          {saving ? '...' : 'Save'}
        </button>
      )}
      {saveError && (
        <span className="text-xs text-red-400 flex-shrink-0 max-w-32 truncate" title={saveError}>
          {saveError}
        </span>
      )}
    </div>
  )
}

export default function BuilderDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params)
  const [builder, setBuilder] = useState<BuilderInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/builders/${name}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setBuilder(data)
        setLoading(false)
      })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [name])

  if (loading) return <p className="text-zinc-500">Loading...</p>
  if (error) return <p className="text-red-400">Error: {error}</p>
  if (!builder) return <p className="text-red-400">Builder &quot;{name}&quot; not found</p>

  const handleParamUpdate = (updatedParam: BuilderParam) => {
    setBuilder(prev => {
      if (!prev) return prev
      return {
        ...prev,
        params: prev.params.map(p => p.name === updatedParam.name ? updatedParam : p),
      }
    })
  }

  const colorParams = builder.params.filter(p => p.type === 'Color')
  const otherParams = builder.params.filter(p => p.type !== 'Color')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{builder.name}</h1>
        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{builder.category}</span>
      </div>
      <p className="text-sm text-zinc-500">{builder.description}</p>
      <p className="text-xs text-zinc-600 font-mono">{builder.filePath}</p>

      {colorParams.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-2">
            Colors <span className="text-zinc-600">({colorParams.length})</span>
          </h2>
          {colorParams.map(p => (
            <ParamEditor key={p.name} builderName={name} param={p} onUpdate={handleParamUpdate} />
          ))}
        </section>
      )}

      {otherParams.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-2">
            Parameters <span className="text-zinc-600">({otherParams.length})</span>
          </h2>
          {otherParams.map(p => (
            <ParamEditor key={p.name} builderName={name} param={p} onUpdate={handleParamUpdate} />
          ))}
        </section>
      )}
    </div>
  )
}
