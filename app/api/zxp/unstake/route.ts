import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// Test mode: 5 min. Production: set UNSTAKE_COOLDOWN_MINUTES=10080 (7 days)
const COOLDOWN_MINUTES = parseInt(process.env.UNSTAKE_COOLDOWN_MINUTES ?? '5')

const APY = 0.08
const DAILY_RATE = APY / 365

function calcAccrued(amount: number, stakedAt: string): number {
  const days = (Date.now() - new Date(stakedAt).getTime()) / 86_400_000
  // Use higher precision for short test periods (no floor yet)
  const raw = amount * DAILY_RATE * days
  return Math.floor(raw)
}

// POST /api/zxp/unstake { wallet, position_id, action: 'request' | 'complete' }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wallet      = (body.wallet as string)?.toLowerCase().trim()
  const position_id = body.position_id as string
  const action      = (body.action as string) ?? 'request'

  if (!wallet || !WALLET_RE.test(wallet) || !position_id) {
    return NextResponse.json({ error: 'wallet and position_id required' }, { status: 400 })
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

  // ── Complete unstake ─────────────────────────────────────────
  if (action === 'complete') {
    if (pos.status !== 'unstaking') {
      return NextResponse.json({ error: 'Unstake not requested for this position' }, { status: 400 })
    }
    if (new Date(pos.unstake_available_at) > new Date()) {
      const secondsLeft = Math.ceil((new Date(pos.unstake_available_at).getTime() - Date.now()) / 1000)
      return NextResponse.json({ error: 'Cooldown not over', seconds_left: secondsLeft }, { status: 400 })
    }

    const rewards = calcAccrued(pos.amount, pos.staked_at)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('zxp_balance, zxp_staked')
      .eq('wallet_address', wallet)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // zxp_balance = free ZXP. On unstake: return pos.amount + rewards to free balance
    const newBalance = profile.zxp_balance + pos.amount + rewards
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
      txs.push({ wallet_address: wallet, type: 'reward', amount: rewards, note: `Staking rewards (8% APY)`, balance_after: newBalance })
    }
    try { await supabaseAdmin.from('zxp_transactions').insert(txs) } catch { /* audit log is best-effort */ }

    return NextResponse.json({ ok: true, returned: pos.amount, rewards, balance: newBalance, staked: newStaked })
  }

  return NextResponse.json({ error: 'Invalid action (use request or complete)' }, { status: 400 })
}
