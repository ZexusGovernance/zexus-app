import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

function calcClaimAmount(_streak: number): number {
  return 1
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wallet = (body.wallet as string)?.toLowerCase().trim()
  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Idempotency: one claim per day
  const { data: existing } = await supabaseAdmin
    .from('daily_checkins')
    .select('id, zxp_earned')
    .eq('wallet_address', wallet)
    .eq('checkin_date', today)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ already_claimed: true, zxp_earned: existing.zxp_earned })
  }

  // Get current profile to determine streak
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance, claim_streak, last_claim_at')
    .eq('wallet_address', wallet)
    .single()

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr = yesterday.toISOString().slice(0, 10)

  const { data: yCheckin } = await supabaseAdmin
    .from('daily_checkins')
    .select('id')
    .eq('wallet_address', wallet)
    .eq('checkin_date', yStr)
    .maybeSingle()

  const newStreak = yCheckin ? (profile?.claim_streak ?? 0) + 1 : 1
  const earned = calcClaimAmount(newStreak)
  const newBalance = (profile?.zxp_balance ?? 0) + earned

  // Insert checkin record
  await supabaseAdmin.from('daily_checkins').insert({
    wallet_address: wallet,
    checkin_date: today,
    streak_day: newStreak,
    zxp_earned: earned,
  })

  // Update profile balance + streak
  await supabaseAdmin
    .from('profiles')
    .update({
      zxp_balance: newBalance,
      claim_streak: newStreak,
      last_claim_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('wallet_address', wallet)

  // Audit log
  await supabaseAdmin.from('zxp_transactions').insert({
    wallet_address: wallet,
    type: 'claim',
    amount: earned,
    note: `Daily claim — streak day ${newStreak}`,
    balance_after: newBalance,
  })

  return NextResponse.json({ ok: true, zxp_earned: earned, new_streak: newStreak, balance: newBalance })
}
