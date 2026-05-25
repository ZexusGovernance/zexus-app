import { NextRequest, NextResponse } from 'next/server'
import { getOnboardingStatus } from '@/lib/onboarding'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// GET /api/zxp/onboarding?wallet=0x...
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  if (!WALLET_RE.test(wallet)) {
    return NextResponse.json({ completed: [], within_window: false })
  }
  const status = await getOnboardingStatus(wallet)
  return NextResponse.json(status)
}
