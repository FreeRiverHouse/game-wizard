import { NextResponse } from 'next/server'
import { getBuilderInfo, updateBuilderParam } from '@/services/builder-parser'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  try {
    const info = getBuilderInfo(name)
    if (!info) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(info)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const body = await request.json()
  const { paramName, newValue } = body

  if (!paramName || newValue === undefined) {
    return NextResponse.json({ error: 'paramName and newValue required' }, { status: 400 })
  }

  try {
    const result = updateBuilderParam(name, paramName, newValue)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    // Ritorna il builder aggiornato con i nuovi valori dal file
    const info = getBuilderInfo(name)
    return NextResponse.json(info)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
