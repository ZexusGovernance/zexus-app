import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/
const APY = 0.08
const DAILY_RATE = APY / 365

function multiplier(stakedAt: string): number {
  const days = (Date.now() - new Date(stakedAt).getTime()) / 86_400_000
  if (days >= 365) return 1.35
  if (days >= 180) return 1.20
  if (days >= 90)  return 1.10
  if (days >= 30)  return 1.05
  return 1.0
}

function accrued(amount: number, stakedAt: string): number {
  const days = (Date.now() - new Date(stakedAt).getTime()) / 86_400_000
  return Math.floor(amount * DAILY_RATE * days)
}

function daysStaked(stakedAt: string): number {
  return Math.floor((Date.now() - new Date(stakedAt).getTime()) / 86_400_000)
}

// GET /api/zxp/positions?wallet=0x...
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  if (!WALLET_RE.test(wallet)) return NextResponse.json({ positions: [] })

  const { data } = await supabaseAdmin
    .from('staking_positions')
    .select('*')
    .eq('wallet_address', wallet)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })

  const positions = (data ?? []).map(p => ({
    ...p,
    accrued_rewards: accrued(p.amount, p.staked_at),
    multiplier: multiplier(p.staked_at),
    days_staked: daysStaked(p.staked_at),
    cooldown_remaining_seconds: p.unstake_available_at
      ? Math.max(0, Math.ceil((new Date(p.unstake_available_at).getTime() - Date.now()) / 1000))
      : null,
  }))

  return NextResponse.json({ positions })
}
