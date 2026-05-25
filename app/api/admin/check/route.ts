import { NextRequest, NextResponse } from 'next/server'

const ADMIN_WALLET = (process.env.SUPER_ADMIN_WALLET ?? '').toLowerCase()

// GET /api/admin/check?wallet=0x...
// Returns {isAdmin: true/false} without exposing which wallet is admin
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  const isAdmin = wallet !== '' && ADMIN_WALLET !== '' && wallet === ADMIN_WALLET
  return NextResponse.json({ isAdmin })
}
