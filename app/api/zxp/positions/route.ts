import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getBurnPool } from '@/lib/burnPool'

const WALLET_RE  = /^0x[0-9a-fA-F]{40}$/
const MAX_APY    = 0.08

// APY accrual multiplier (boosts rewards)
function apyMultiplier(stakedAt: string): number {
  const days = (Date.now() - new Date(stakedAt).getTime()) / 86_400_000
  if (days >= 365) return 1.35
  if (days >= 180) return 1.20
  if (days >= 90)  return 1.10
  if (days >= 30)  return 1.05
  return 1.0
}

// Vote power multiplier — must match vote/route.ts timeBonus
function voteMultiplier(stakedAt: string): number {
  const days = (Date.now() - new Date(stakedAt).getTime()) / 86_400_000
  if (days >= 365) return 2.2
  if (days >= 180) return 1.8
  if (days >= 90)  return 1.5
  if (days >= 30)  return 1.2
  return 1.0
}

function accrued(amount: number, stakedAt: string, apy: number): number {
  const hours = (Date.now() - new Date(stakedAt).getTime()) / 3_600_000
  // keep 4 decimals so small rewards drip visibly instead of flooring to 0
  return Math.round(amount * (apy / (365 * 24)) * hours * 10_000) / 10_000
}

function daysStaked(stakedAt: string): number {
  return Math.floor((Date.now() - new Date(stakedAt).getTime()) / 86_400_000)
}

// GET /api/zxp/positions?wallet=0x...
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  if (!WALLET_RE.test(wallet)) return NextResponse.json({ positions: [], apy_bps: 800 })

  const [{ data }, { data: epochCfg }, pool] = await Promise.all([
    supabaseAdmin
      .from('staking_positions')
      .select('*')
      .eq('wallet_address', wallet)
      .neq('status', 'completed')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('epoch_config')
      .select('current_apy_bps')
      .eq('id', 1)
      .single(),
    getBurnPool(),
  ])

  const baseApy = Math.min(MAX_APY, Math.min(800, (epochCfg?.current_apy_bps as number) ?? 800) / 10000)
  const apy     = baseApy + pool.bonus           // + Community Burn Pool bonus
  const apyBps  = Math.round(apy * 10000)        // effective rate (base + community bonus)

  const positions = (data ?? []).map(p => ({
    ...p,
    accrued_rewards:  accrued(p.amount, p.staked_at, apy),
    multiplier:       apyMultiplier(p.staked_at),
    vote_multiplier:  voteMultiplier(p.staked_at),
    days_staked:      daysStaked(p.staked_at),
    cooldown_remaining_seconds: p.unstake_available_at
      ? Math.max(0, Math.ceil((new Date(p.unstake_available_at).getTime() - Date.now()) / 1000))
      : null,
  }))

  return NextResponse.json({ positions, apy_bps: apyBps })
}
