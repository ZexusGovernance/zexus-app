import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/
const MIN_STAKE = 1

// Model: zxp_balance = FREE balance only, zxp_staked = locked balance
// Total ZXP = zxp_balance + zxp_staked
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wallet = (body.wallet as string)?.toLowerCase().trim()
  const amount = Number(body.amount)

  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
  }
  if (!amount || amount < MIN_STAKE || !Number.isInteger(amount)) {
    return NextResponse.json({ error: `Minimum stake is ${MIN_STAKE} ZXP` }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance, zxp_staked')
    .eq('wallet_address', wallet)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (amount > profile.zxp_balance) {
    return NextResponse.json({ error: `Insufficient free ZXP (have ${profile.zxp_balance})` }, { status: 400 })
  }

  const newBalance = profile.zxp_balance - amount
  const newStaked  = profile.zxp_staked  + amount

  const { data: position, error: posErr } = await supabaseAdmin
    .from('staking_positions')
    .insert({ wallet_address: wallet, amount })
    .select('id')
    .single()

  if (posErr) return NextResponse.json({ error: posErr.message }, { status: 500 })

  await supabaseAdmin
    .from('profiles')
    .update({ zxp_balance: newBalance, zxp_staked: newStaked, updated_at: new Date().toISOString() })
    .eq('wallet_address', wallet)

  try {
    await supabaseAdmin.from('zxp_transactions').insert({
      wallet_address: wallet,
      type: 'stake',
      amount: -amount,
      note: `Staked ${amount} ZXP`,
      balance_after: newBalance,
    })
  } catch { /* audit log is best-effort */ }

  return NextResponse.json({ ok: true, position_id: position!.id, balance: newBalance, staked: newStaked })
}
