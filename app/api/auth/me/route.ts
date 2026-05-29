import { NextRequest, NextResponse } from 'next/server'
import { getSessionAddress } from '@/lib/auth'

// GET /api/auth/me — returns the current signed-in address (or null).
export async function GET(req: NextRequest) {
  const address = getSessionAddress(req)
  return NextResponse.json({ address })
}
