import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { monthStartISO, monthDaysLeft } from '@/lib/burnPool'

// Season = current calendar month. Season XP = ZXP *earned* this month
// (rewards, check-ins, verdicts, referrals, onboarding, predict wins, claims).
// Computed live from zxp_transactions, no separate table or accrual system.
const EARN_TYPES = ['reward', 'checkin', 'verdict', 'referral', 'onboarding', 'predict_win', 'claim']
const TOP_N = 50

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() || null
  const start  = monthStartISO()

  const { data: txs } = await supabaseAdmin
    .from('zxp_transactions')
    .select('wallet_address, amount, type')
    .gte('created_at', start)
    .gt('amount', 0)

  const totals = new Map<string, number>()
  for (const t of txs ?? []) {
    if (!EARN_TYPES.includes(t.type as string)) continue
    const w = t.wallet_address as string
    totals.set(w, (totals.get(w) ?? 0) + (t.amount as number))
  }

  // Fetch profile + settings for all earners — used for opt-out filtering and enrichment
  const earnerWallets = [...totals.keys()]
  const { data: profs } = earnerWallets.length
    ? await supabaseAdmin
        .from('profiles')
        .select('wallet_address, display_name, avatar_url, settings')
        .in('wallet_address', earnerWallets)
    : { data: [] }
  const pmap = new Map((profs ?? []).map(p => [p.wallet_address as string, p]))

  // Respect the "Show in leaderboard" privacy toggle (opt-out — hidden only if explicitly off)
  const ranked = [...totals.entries()]
    .filter(([w]) => (pmap.get(w)?.settings as Record<string, boolean> | null)?.showLeaderboard !== false)
    .map(([w, xp]) => ({ wallet: w, xp }))
    .sort((a, b) => b.xp - a.xp)

  const top = ranked.slice(0, TOP_N)

  const topRows = top.map((t, i) => ({
    rank:   i + 1,
    wallet: t.wallet,
    xp:     t.xp,
    name:   (pmap.get(t.wallet)?.display_name as string) ?? null,
    avatar: (pmap.get(t.wallet)?.avatar_url as string) ?? null,
  }))

  let me: { rank: number; wallet: string; xp: number } | null = null
  if (wallet) {
    const idx = ranked.findIndex(r => r.wallet === wallet)
    if (idx >= 0) me = { rank: idx + 1, wallet, xp: ranked[idx].xp }
  }

  return NextResponse.json({
    season:        start.slice(0, 7),
    days_left:     monthDaysLeft(),
    total_players: ranked.length,
    top:           topRows,
    me,
  })
}
