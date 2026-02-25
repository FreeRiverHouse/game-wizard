import { NextResponse } from 'next/server'
import { analyzeScreenshot } from '@/services/ai'
import { REFERENCE_IMAGE } from '@/lib/constants'

export async function POST(request: Request) {
  const body = await request.json()
  const { screenshotPath, context, referencePath } = body

  if (!screenshotPath) {
    return NextResponse.json({ error: 'screenshotPath required' }, { status: 400 })
  }

  try {
    const result = await analyzeScreenshot(
      screenshotPath,
      referencePath || REFERENCE_IMAGE,
      context || ''
    )
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
