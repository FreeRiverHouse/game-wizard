import { NextResponse } from 'next/server'
import { stopLoop } from '@/services/loop'

export async function POST() {
  stopLoop()
  return NextResponse.json({ ok: true, message: 'Loop stopped' })
}
