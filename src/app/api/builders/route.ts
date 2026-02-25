import { NextResponse } from 'next/server'
import { getAllBuilders } from '@/services/builder-parser'

export async function GET() {
  try {
    const builders = getAllBuilders()
    return NextResponse.json(builders)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
