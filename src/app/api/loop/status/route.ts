import { NextResponse } from 'next/server'
import { getLoopStatus } from '@/services/loop'

export async function GET() {
  return NextResponse.json(getLoopStatus())
}
