import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { generateCodeChanges } from '@/services/ai'
import { GAME_PATH, BUILDERS_DIR, CORE_DIR } from '@/lib/constants'

export async function POST(request: Request) {
  const body = await request.json()
  const { analysis, filePath } = body

  if (!analysis || !filePath) {
    return NextResponse.json({ error: 'analysis and filePath required' }, { status: 400 })
  }

  const inBuilders = path.join(BUILDERS_DIR, filePath)
  const inCore = path.join(CORE_DIR, filePath)
  const actualPath = fs.existsSync(inBuilders) ? inBuilders : fs.existsSync(inCore) ? inCore : null

  if (!actualPath) {
    return NextResponse.json({ error: `File not found: ${filePath}` }, { status: 404 })
  }

  try {
    const content = fs.readFileSync(actualPath, 'utf-8')
    const result = await generateCodeChanges(analysis, content, filePath)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
