import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// Burn permanently destroys ZXP from free balance.
// Influence boost = burned_amount * 2 (computed client-side for session display).
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
  if (!amount || amount < 1 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'amount must be a positive integer' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance')
    .eq('wallet_address', wallet)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.zxp_balance < amount) {
    return NextResponse.json({ error: `Insufficient free ZXP (have ${profile.zxp_balance})` }, { status: 400 })
  }

  const newBalance = profile.zxp_balance - amount

  await supabaseAdmin
    .from('profiles')
    .update({ zxp_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('wallet_address', wallet)

  try {
    await supabaseAdmin.from('zxp_transactions').insert({
      wallet_address: wallet,
      type: 'burn',
      amount: -amount,
      note: `Burned ${amount} ZXP for influence boost`,
      balance_after: newBalance,
    })
  } catch { /* audit log is best-effort */ }

  return NextResponse.json({ ok: true, burned: amount, balance: newBalance, influence_boost: amount * 2 })
}
