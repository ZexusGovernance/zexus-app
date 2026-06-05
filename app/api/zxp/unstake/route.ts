import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { notifyWallet } from '@/lib/telegram'
import { requireAuth, unauthorized } from '@/lib/auth'
import { getBurnPool } from '@/lib/burnPool'

// Test mode: 5 min. Production: set UNSTAKE_COOLDOWN_MINUTES=10080 (7 days)
const COOLDOWN_MINUTES = parseInt(process.env.UNSTAKE_COOLDOWN_MINUTES ?? '5')

async function getApy(): Promise<number> {
  const [{ data }, pool] = await Promise.all([
    supabaseAdmin.from('epoch_config').select('current_apy_bps').eq('id', 1).single(),
    getBurnPool(),
  ])
  const base = Math.min(0.08, ((data?.current_apy_bps as number) ?? 800) / 10000)
  return base + pool.bonus  // + Community Burn Pool bonus
}

function calcAccrued(amount: number, stakedAt: string, apy: number): number {
  const hours = (Date.now() - new Date(stakedAt).getTime()) / 3_600_000
  return Math.floor(amount * (apy / (365 * 24)) * hours)
}

// POST /api/zxp/unstake { wallet, position_id, action: 'request' | 'cancel' | 'complete' }
export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const position_id = body.position_id as string
  const action      = (body.action as string) ?? 'request'

  if (!position_id) {
    return NextResponse.json({ error: 'position_id required' }, { status: 400 })
  }

  const { data: pos } = await supabaseAdmin
    .from('staking_positions')
    .select('*')
    .eq('id', position_id)
    .eq('wallet_address', wallet)
    .single()

  if (!pos) return NextResponse.json({ error: 'Position not found' }, { status: 404 })

  // ── Request unstake ──────────────────────────────────────────
  if (action === 'request') {
    if (pos.status !== 'active') {
      return NextResponse.json({ error: 'Position is not active' }, { status: 400 })
    }
    const available = new Date(Date.now() + COOLDOWN_MINUTES * 60_000).toISOString()
    await supabaseAdmin
      .from('staking_positions')
      .update({ status: 'unstaking', unstake_requested_at: new Date().toISOString(), unstake_available_at: available })
      .eq('id', position_id)

    return NextResponse.json({ ok: true, available_at: available, cooldown_minutes: COOLDOWN_MINUTES })
  }

  // ── Cancel unstake (re-activate before cooldown completes) ────
  if (action === 'cancel') {
    if (pos.status !== 'unstaking') {
      return NextResponse.json({ error: 'Position is not unstaking' }, { status: 400 })
    }
    await supabaseAdmin
      .from('staking_positions')
      .update({ status: 'active', unstake_requested_at: null, unstake_available_at: null })
      .eq('id', position_id)

    return NextResponse.json({ ok: true, status: 'active' })
  }

  // ── Complete unstake ─────────────────────────────────────────
  if (action === 'complete') {
    if (pos.status !== 'unstaking') {
      return NextResponse.json({ error: 'Unstake not requested for this position' }, { status: 400 })
    }
    if (new Date(pos.unstake_available_at) > new Date()) {
      const secondsLeft = Math.ceil((new Date(pos.unstake_available_at).getTime() - Date.now()) / 1000)
      return NextResponse.json({ error: 'Cooldown not over', seconds_left: secondsLeft }, { status: 400 })
    }

    const apy     = await getApy()
    const rewards = calcAccrued(pos.amount, pos.staked_at, apy)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('zxp_balance, zxp_staked')
      .eq('wallet_address', wallet)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // zxp_balance = free ZXP. On unstake: return pos.amount + rewards to free balance
    const newBalance = Math.floor(profile.zxp_balance + pos.amount + rewards)
    const newStaked  = Math.max(0, profile.zxp_staked - pos.amount)

    await supabaseAdmin
      .from('staking_positions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', position_id)

    await supabaseAdmin
      .from('profiles')
      .update({ zxp_balance: newBalance, zxp_staked: newStaked, updated_at: new Date().toISOString() })
      .eq('wallet_address', wallet)

    // Audit log
    const txs = [
      { wallet_address: wallet, type: 'unstake', amount: pos.amount, note: `Unstaked position`, balance_after: newBalance },
    ]
    if (rewards > 0) {
      txs.push({ wallet_address: wallet, type: 'reward', amount: rewards, note: `Staking rewards (${Math.round(apy * 100)}% APY)`, balance_after: newBalance })
    }
    try { await supabaseAdmin.from('zxp_transactions').insert(txs) } catch { /* audit log is best-effort */ }

    if (rewards > 0) {
      void notifyWallet(wallet,
        `💰 <b>+${rewards} ZXP</b> — Staking rewards\n` +
        `Unstaked ${pos.amount} ZXP + ${rewards} ZXP rewards · Balance: ${newBalance} ZXP\n\n` +
        `<a href="https://app.zexus.xyz">Open Zexus</a>`,
        'notifZxp',
      )
    }

    return NextResponse.json({ ok: true, returned: pos.amount, rewards, balance: newBalance, staked: newStaked })
  }

  return NextResponse.json({ error: 'Invalid action (use request, cancel, or complete)' }, { status: 400 })
}
