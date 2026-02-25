import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { GAME_PATH } from '@/lib/constants'

// Directory consentite per lettura immagini (path traversal prevention)
const ALLOWED_DIRS = [
  '/tmp/',
  path.join(GAME_PATH, 'screenshots') + path.sep,
  path.join(GAME_PATH, 'references') + path.sep,
]

function isAllowedPath(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  return ALLOWED_DIRS.some(dir => resolved.startsWith(dir) || resolved === dir.replace(/\/$/, '').replace(/\/$/, ''))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  if (!filePath) {
    return new NextResponse('Missing path', { status: 400 })
  }

  // Security: blocca path traversal
  if (!isAllowedPath(filePath)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const buffer = fs.readFileSync(filePath)
  const ext = filePath.split('.').pop()?.toLowerCase()
  const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

  return new NextResponse(buffer, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-cache' },
  })
}
