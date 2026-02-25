'use client'

import { useState, useEffect } from 'react'
import IterationTimeline from '@/components/IterationTimeline'
import ScreenshotViewer from '@/components/ScreenshotViewer'
import type { IterationRow } from '@/lib/types'

export default function HistoryPage() {
  const [iterations, setIterations] = useState<IterationRow[]>([])
  const [selected, setSelected] = useState<IterationRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/iterations?limit=50')
      .then(res => res.json())
      .then(data => {
        setIterations(data.iterations || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-zinc-500">Loading history...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">History ({iterations.length} iterations)</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="col-span-1 max-h-[70vh] overflow-y-auto">
          <IterationTimeline
            iterations={iterations}
            onSelect={setSelected}
            selectedId={selected?.id}
          />
        </div>

        {/* Detail */}
        <div className="col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium">Iteration {selected.number}</h2>
                {selected.commit_hash && (
                  <span className="text-sm text-zinc-500 font-mono">#{selected.commit_hash.slice(0, 7)}</span>
                )}
              </div>

              {/* Screenshots */}
              <ScreenshotViewer
                currentPath={selected.screenshot_path || undefined}
                referencePath={selected.reference_path || undefined}
                label="Screenshots"
              />

              {/* AI Analysis */}
              {selected.ai_analysis && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">AI Analysis</h3>
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap overflow-auto max-h-60">
                    {JSON.stringify(JSON.parse(selected.ai_analysis), null, 2)}
                  </pre>
                </div>
              )}

              {/* Diff */}
              {selected.diff && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Diff</h3>
                  <pre className="text-xs font-mono overflow-auto max-h-60">
                    {selected.diff.split('\n').map((line, i) => (
                      <span
                        key={i}
                        className={
                          line.startsWith('+') ? 'text-green-400' :
                          line.startsWith('-') ? 'text-red-400' :
                          'text-zinc-500'
                        }
                      >
                        {line}{'\n'}
                      </span>
                    ))}
                  </pre>
                </div>
              )}

              {/* Files Modified */}
              {selected.files_modified && (
                <div className="text-xs text-zinc-500">
                  Files modified: {JSON.parse(selected.files_modified).join(', ')}
                </div>
              )}

              {/* Error */}
              {selected.error && (
                <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-xs text-red-300">
                  Error: {selected.error}
                </div>
              )}
            </>
          ) : (
            <p className="text-zinc-600">Select an iteration from the timeline</p>
          )}
        </div>
      </div>
    </div>
  )
}
