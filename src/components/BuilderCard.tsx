'use client'

import Link from 'next/link'
import type { BuilderInfo } from '@/lib/types'

interface Props {
  builder: BuilderInfo
}

export default function BuilderCard({ builder }: Props) {
  const colorParams = builder.params.filter(p => p.type === 'Color').length
  const numericParams = builder.params.filter(p => p.type === 'float' || p.type === 'int').length

  return (
    <Link
      href={`/builders/${builder.name}`}
      className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-white">{builder.name}</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
          {builder.category}
        </span>
      </div>
      <p className="text-xs text-zinc-500 mb-3 line-clamp-1">{builder.description}</p>
      <div className="flex gap-3 text-xs text-zinc-500">
        <span>{colorParams} colors</span>
        <span>{numericParams} numbers</span>
        <span>{builder.params.length} total</span>
      </div>
    </Link>
  )
}
