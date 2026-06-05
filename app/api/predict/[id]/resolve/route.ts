import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { notifyWallet } from '@/lib/telegram'
import { requireAuth, isSuperAdmin } from '@/lib/auth'

const ADMIN_WALLET = (process.env.SUPER_ADMIN_WALLET ?? '').toLowerCase()
const FEE = 0.02  // 2% platform fee → burned

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: marketId } = await params

  if (!isSuperAdmin(requireAuth(req)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const outcome = body.outcome as string

  if (!['a', 'b'].includes(outcome))
    return NextResponse.json({ error: 'outcome must be "a" or "b"' }, { status: 400 })

  const { data: market } = await supabaseAdmin
    .from('predict_markets')
    .select('*')
    .eq('id', marketId)
    .single()

  if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  if (market.status === 'resolved') return NextResponse.json({ error: 'Already resolved' }, { status: 400 })

  const poolA  = (market.pool_a as number) ?? 0
  const poolB  = (market.pool_b as number) ?? 0
  const total  = poolA + poolB
  const fee    = total > 0 ? Math.max(1, Math.floor(total * FEE)) : 0
  const prize  = Math.max(0, total - fee)
  const winPool = outcome === 'a' ? poolA : poolB

  // Fetch all bets for this market
  const { data: bets } = await supabaseAdmin
    .from('predict_bets')
    .select('*')
    .eq('market_id', marketId)

  const winners = (bets ?? []).filter(b => b.option === outcome)

  // Mark market resolved first
  await supabaseAdmin.from('predict_markets').update({
    status:      'resolved',
    outcome,
    resolved_at: new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  }).eq('id', marketId)

  let totalPaid = 0

  for (const bet of winners) {
    const betAmt = (bet.amount as number) ?? 0
    const payout = winPool > 0 ? Math.floor((betAmt / winPool) * prize) : 0
    if (payout <= 0) continue

    const w = bet.wallet_address as string
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('zxp_balance')
      .eq('wallet_address', w)
      .single()
    if (!prof) continue

    const newBal = (prof.zxp_balance as number) + payout
    await Promise.all([
      supabaseAdmin.from('predict_bets')
        .update({ payout })
        .eq('id', bet.id as string),
      supabaseAdmin.from('profiles')
        .update({ zxp_balance: newBal, updated_at: new Date().toISOString() })
        .eq('wallet_address', w),
      supabaseAdmin.from('zxp_transactions').insert({
        wallet_address: w,
        type:           'predict_win',
        amount:         payout,
        note:           `Predict win — "${(market.title as string).slice(0, 50)}"`,
        balance_after:  newBal,
      }),
    ])
    void notifyWallet(w,
      `🏆 <b>+${payout} ZXP</b> — Predict win!\n` +
      `"${(market.title as string).slice(0, 60)}"\n` +
      `Balance: ${newBal} ZXP\n\n` +
      `<a href="https://app.zexus.xyz">Open Zexus</a>`,
      'notifZxp',
    )
    totalPaid += payout
  }

  // Burn the fee (best-effort)
  if (fee > 0) {
    try {
      await supabaseAdmin.from('zxp_transactions').insert({
        wallet_address: ADMIN_WALLET || 'platform',
        type:           'burn',
        amount:         -fee,
        note:           `Predict fee 2% — "${(market.title as string).slice(0, 50)}"`,
        balance_after:  0,
      })
    } catch { /* best-effort */ }
  }

  return NextResponse.json({
    ok: true, outcome, total, fee, prize,
    winners: winners.length, paid: totalPaid,
  })
}
