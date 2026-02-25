'use client'

import StatusBadge from './StatusBadge'
import type { IterationRow } from '@/lib/types'

interface Props {
  iterations: IterationRow[]
  onSelect?: (iter: IterationRow) => void
  selectedId?: number
}

export default function IterationTimeline({ iterations, onSelect, selectedId }: Props) {
  if (iterations.length === 0) {
    return <p className="text-zinc-600 text-sm">No iterations yet. Run the loop to get started!</p>
  }

  return (
    <div className="space-y-2">
      {iterations.map(iter => (
        <button
          key={iter.id}
          onClick={() => onSelect?.(iter)}
          className={`w-full text-left bg-zinc-900 border rounded-lg px-4 py-3 transition-colors ${
            selectedId === iter.id ? 'border-blue-500' : 'border-zinc-800 hover:border-zinc-600'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-white text-sm">Iter {iter.number}</span>
            <StatusBadge status={iter.status} />
          </div>
          {iter.commit_message && (
            <p className="text-xs text-zinc-400 mb-1 truncate">{iter.commit_message}</p>
          )}
          <div className="flex gap-3 text-xs text-zinc-600">
            {iter.commit_hash && <span>#{iter.commit_hash.slice(0, 7)}</span>}
            {iter.ai_tokens_used > 0 && <span>{iter.ai_tokens_used} tokens</span>}
            {iter.duration_ms && <span>{Math.round(iter.duration_ms / 1000)}s</span>}
            <span className="ml-auto">{new Date(iter.created_at).toLocaleString()}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
