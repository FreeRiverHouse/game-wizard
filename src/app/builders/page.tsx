'use client'

import { useState, useEffect } from 'react'
import BuilderCard from '@/components/BuilderCard'
import type { BuilderInfo } from '@/lib/types'

export default function BuildersPage() {
  const [builders, setBuilders] = useState<BuilderInfo[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/builders')
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setBuilders(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [])

  const categories = ['all', ...Array.from(new Set(builders.map(b => b.category)))]
  const filtered = filter === 'all' ? builders : builders.filter(b => b.category === filter)

  if (loading) return <p className="text-zinc-500">Loading builders...</p>
  if (error) return <p className="text-red-400">Error: {error}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Builders ({builders.length})</h1>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                filter === cat ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(b => (
          <BuilderCard key={b.name} builder={b} />
        ))}
      </div>
    </div>
  )
}
