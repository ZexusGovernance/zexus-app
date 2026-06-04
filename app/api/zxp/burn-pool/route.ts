import { NextResponse } from 'next/server'
import { getBurnPool } from '@/lib/burnPool'

export async function GET() {
  const pool = await getBurnPool()
  return NextResponse.json(pool)
}
