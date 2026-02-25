import { NextResponse } from 'next/server'
import { approveChanges } from '@/services/loop'

export async function POST(request: Request) {
  const body = await request.json()
  approveChanges(body.approved === true)
  return NextResponse.json({ ok: true })
}
