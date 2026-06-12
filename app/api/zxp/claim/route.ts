import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { notifyWallet } from '@/lib/telegram'
import { requireAuth, unauthorized } from '@/lib/auth'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function calcClaimAmount(_streak: number): number {
  return 1
}

// Use the caller's local date (sent by the client) so the daily boundary
// follows the user's timezone, not UTC. Bounded to ±1 day of server UTC so a
// client can't fabricate arbitrary dates to farm extra check-ins.
function resolveToday(input?: string | null): string {
  const utc = new Date().toISOString().slice(0, 10)
  if (!input || !DATE_RE.test(input)) return utc
  const diff = Math.abs(
    new Date(`${input}T00:00:00Z`).getTime() - new Date(`${utc}T00:00:00Z`).getTime(),
  )
  return diff <= 86_400_000 ? input : utc
}

function prevDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim()
  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ checked_in: false, zxp_earned: 0, streak_day: 0 })
  }
  const today = resolveToday(req.nextUrl.searchParams.get('date'))
  const { data } = await supabaseAdmin
    .from('daily_checkins')
    .select('id, zxp_earned, streak_day')
    .eq('wallet_address', wallet)
    .eq('checkin_date', today)
    .maybeSingle()
  return NextResponse.json({
    checked_in: !!data,
    zxp_earned: data?.zxp_earned ?? 0,
    streak_day: data?.streak_day ?? 0,
  })
}

export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  const body = await req.json().catch(() => ({}) as { date?: string })
  const today = resolveToday(body.date)

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

  const yStr = prevDay(today)

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

  void notifyWallet(wallet,
    `🪙 <b>+${earned} ZXP</b> — Daily check-in\n` +
    `Day ${newStreak} streak · Balance: ${newBalance} ZXP\n\n` +
    `<a href="https://app.zexus.xyz">Open Zexus</a>`,
    'notifZxp',
  )

  return NextResponse.json({ ok: true, zxp_earned: earned, new_streak: newStreak, balance: newBalance })
}
