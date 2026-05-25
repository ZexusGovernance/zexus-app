import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const MAX_APY_BPS = 800  // 8% hard ceiling

// Tiered retention at epoch end based on activity:
//   staking OR 3+ votes → 100% retained (no loss)
//   1–2 votes           →  90% retained (−10%)
//   0 votes, not staked →  70% retained (−30%)
const TIER: Record<'inactive' | 'low' | 'active', number> = {
  inactive: 0.70,
  low:      0.90,
  active:   1.00,
}

function medianOf(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.floor((sorted[mid - 1] + sorted[mid]) / 2)
}

// Recalculate pool APY and cache median balance — runs every day
async function refreshApyAndMedian(): Promise<{ apyBps: number; median: number }> {
  const [{ data: profiles }, { data: active }, { data: cfg }] = await Promise.all([
    supabaseAdmin.from('profiles').select('zxp_balance'),
    supabaseAdmin.from('staking_positions').select('amount').eq('status', 'active'),
    supabaseAdmin.from('epoch_config').select('staking_budget').eq('id', 1).single(),
  ])

  const balances    = (profiles ?? []).map(p => (p.zxp_balance as number) ?? 0)
  const newMedian   = medianOf(balances)
  const totalStaked = (active ?? []).reduce((s, p) => s + ((p.amount as number) ?? 0), 0)
  const budget      = (cfg?.staking_budget as number) ?? 8000

  const poolApyBps = totalStaked > 0
    ? Math.min(MAX_APY_BPS, Math.floor((budget * 2 * 10000) / totalStaked))
    : MAX_APY_BPS

  await supabaseAdmin.from('epoch_config').update({
    current_apy_bps: poolApyBps,
    median_balance:  newMedian,
    updated_at:      new Date().toISOString(),
  }).eq('id', 1)

  return { apyBps: poolApyBps, median: newMedian }
}

// At epoch end: apply tiered burn based on activity this epoch
async function processUsers(epochStart: string): Promise<{ inactive: number; low: number }> {
  const [{ data: allProfiles }, { data: stakerRows }, { data: voteRows }] = await Promise.all([
    supabaseAdmin.from('profiles')
      .select('wallet_address, zxp_balance, zxp_burned, zxp_staked')
      .gt('zxp_balance', 0),
    // Wallets with active stake
    supabaseAdmin.from('staking_positions')
      .select('wallet_address')
      .eq('status', 'active'),
    // Vote counts per wallet since epoch start
    supabaseAdmin.from('voting_votes')
      .select('wallet_address')
      .gte('created_at', epochStart),
  ])

  const stakerSet  = new Set((stakerRows  ?? []).map(r => r.wallet_address as string))
  const voteCount  = new Map<string, number>()
  for (const v of (voteRows ?? [])) {
    const w = v.wallet_address as string
    voteCount.set(w, (voteCount.get(w) ?? 0) + 1)
  }

  const epochTag = new Date(epochStart).toISOString().slice(0, 10)
  let inactiveCount = 0
  let lowCount      = 0

  for (const p of (allProfiles ?? [])) {
    const wallet  = p.wallet_address as string
    const balance = (p.zxp_balance as number) ?? 0
    if (balance <= 0) continue

    const votes    = voteCount.get(wallet) ?? 0
    const staking  = stakerSet.has(wallet)

    let ratio: number
    let tierLabel: string
    if (staking || votes >= 3) {
      ratio = TIER.active
      tierLabel = 'active'
    } else if (votes >= 1) {
      ratio = TIER.low
      tierLabel = 'low activity'
      lowCount++
    } else {
      ratio = TIER.inactive
      tierLabel = 'inactive'
      inactiveCount++
    }

    if (ratio >= 1) continue  // active users untouched

    const newBalance = Math.floor(balance * ratio)
    const burned     = balance - newBalance
    if (burned <= 0) continue

    await Promise.all([
      supabaseAdmin.from('profiles').update({
        zxp_balance: newBalance,
        zxp_burned:  ((p.zxp_burned as number) ?? 0) + burned,
        updated_at:  new Date().toISOString(),
      }).eq('wallet_address', wallet),
      supabaseAdmin.from('zxp_transactions').insert({
        wallet_address: wallet,
        type:           'burn',
        amount:         -burned,
        note:           `Epoch ${epochTag} — ${tierLabel} (${Math.round(ratio * 100)}% retained)`,
        balance_after:  newBalance,
      }),
    ])
  }

  return { inactive: inactiveCount, low: lowCount }
}

async function advanceEpoch(epochNumber: number): Promise<void> {
  const now     = new Date()
  const nextEnd = new Date(now)
  nextEnd.setMonth(nextEnd.getMonth() + 6)

  await supabaseAdmin.from('epoch_config').update({
    epoch_number:    epochNumber + 1,
    epoch_start:     now.toISOString(),
    epoch_end:       nextEnd.toISOString(),
    current_apy_bps: MAX_APY_BPS,
    updated_at:      now.toISOString(),
  }).eq('id', 1)
}

// GET /api/cron/epoch-maintenance — Vercel Cron, daily at 03:00
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret') ?? ''
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: cfg } = await supabaseAdmin.from('epoch_config').select('*').eq('id', 1).single()
  if (!cfg) return NextResponse.json({ error: 'epoch_config missing' }, { status: 500 })

  const epochOver  = new Date(cfg.epoch_end as string) <= new Date()
  const epochStart = cfg.epoch_start as string

  const { apyBps, median } = await refreshApyAndMedian()

  let processed: { inactive: number; low: number } = { inactive: 0, low: 0 }
  let epochAdvanced = false

  if (epochOver) {
    processed = await processUsers(epochStart)
    await advanceEpoch(cfg.epoch_number as number)
    epochAdvanced = true
  }

  return NextResponse.json({ ok: true, apyBps, median, ...processed, epochAdvanced })
}
