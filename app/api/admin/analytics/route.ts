import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const ADMIN_WALLET = (process.env.SUPER_ADMIN_WALLET ?? '').toLowerCase()

function isAdmin(wallet: unknown): boolean {
  return typeof wallet === 'string' && wallet.toLowerCase() === ADMIN_WALLET && ADMIN_WALLET !== ''
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet') ?? ''
  if (!isAdmin(wallet)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    profilesRes,
    projectsRes,
    postsRes,
    likesRes,
    commentsRes,
    watchlistRes,
    checkinsRes,
    zxpRes,
    zxpTodayRes,
    newUsersRes,
    active7dRes,
    topHoldersRes,
    topStakersRes,
    posts7dRes,
    checkins7dRes,
    onboardingRes,
    posts30dRes,
    checkins30dRes,
    supplyHistoryRes,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('post_reactions').select('*', { count: 'exact', head: true }).eq('reaction', 'like'),
    supabaseAdmin.from('post_comments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('user_watchlist').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('daily_checkins').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('zxp_balance, zxp_staked'),
    supabaseAdmin.from('zxp_transactions').select('amount').eq('type', 'claim').gte('created_at', today),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('registered_at', today),
    supabaseAdmin.from('daily_checkins').select('wallet_address').gte('checkin_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabaseAdmin.from('profiles').select('wallet_address, zxp_balance, claim_streak').order('zxp_balance', { ascending: false }).limit(10),
    supabaseAdmin.from('profiles').select('wallet_address, zxp_staked').gt('zxp_staked', 0).order('zxp_staked', { ascending: false }).limit(10),
    supabaseAdmin.from('posts').select('created_at').gte('created_at', sevenDaysAgo),
    supabaseAdmin.from('daily_checkins').select('checkin_date').gte('checkin_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabaseAdmin.from('onboarding_rewards').select('action, wallet_address'),
    supabaseAdmin.from('posts').select('created_at').gte('created_at', thirtyDaysAgo),
    supabaseAdmin.from('daily_checkins').select('checkin_date').gte('checkin_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabaseAdmin.from('zxp_supply_snapshots').select('date, circulating, staked').order('date', { ascending: true }).limit(60),
  ])

  // ZXP totals — circulating includes staked (staked is still user-owned)
  const profiles = zxpRes.data ?? []
  const totalStaked      = profiles.reduce((s, p) => s + (p.zxp_staked  ?? 0), 0)
  const totalCirculating = profiles.reduce((s, p) => s + (p.zxp_balance ?? 0) + (p.zxp_staked ?? 0), 0)
  const totalEarnedToday = (zxpTodayRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

  // Upsert today's supply snapshot
  await supabaseAdmin.from('zxp_supply_snapshots').upsert(
    { date: today, circulating: totalCirculating, staked: totalStaked },
    { onConflict: 'date' }
  )

  // Active 7d (unique wallets with check-in)
  const active7d = new Set((active7dRes.data ?? []).map(r => r.wallet_address)).size

  // Posts by day — last 7 days
  const dayMap7d: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    dayMap7d[d] = 0
  }
  for (const p of posts7dRes.data ?? []) {
    const d = new Date(p.created_at).toISOString().slice(0, 10)
    if (d in dayMap7d) dayMap7d[d]++
  }

  // Check-ins by day — last 7 days
  const ciMap7d: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    ciMap7d[d] = 0
  }
  for (const c of checkins7dRes.data ?? []) {
    const d = c.checkin_date
    if (d in ciMap7d) ciMap7d[d]++
  }

  // Posts by day — last 30 days
  const dayMap30d: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    dayMap30d[d] = 0
  }
  for (const p of posts30dRes.data ?? []) {
    const d = new Date(p.created_at).toISOString().slice(0, 10)
    if (d in dayMap30d) dayMap30d[d]++
  }

  // Checkins by day — last 30 days
  const ciMap30d: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    ciMap30d[d] = 0
  }
  for (const c of checkins30dRes.data ?? []) {
    const d = c.checkin_date
    if (d in ciMap30d) ciMap30d[d]++
  }

  // Onboarding funnel
  const onboarding: Record<string, number> = { connect: 0, reaction: 0, comment: 0, watchlist: 0 }
  for (const r of onboardingRes.data ?? []) {
    if (r.action in onboarding) onboarding[r.action]++
  }

  return NextResponse.json({
    platform: {
      total_users:            profilesRes.count    ?? 0,
      total_projects:         projectsRes.count    ?? 0,
      total_posts:            postsRes.count       ?? 0,
      total_likes:            likesRes.count       ?? 0,
      total_comments:         commentsRes.count    ?? 0,
      total_watchlist_entries:watchlistRes.count   ?? 0,
      total_checkins:         checkinsRes.count    ?? 0,
      new_users_today:        newUsersRes.count    ?? 0,
      active_users_7d:        active7d,
    },
    zxp: {
      total_circulating:  totalCirculating,
      total_staked:       totalStaked,
      earned_today:       totalEarnedToday,
    },
    top_holders: (topHoldersRes.data ?? []).map((p, i) => ({
      rank:    i + 1,
      wallet:  p.wallet_address,
      balance: p.zxp_balance ?? 0,
      streak:  p.claim_streak ?? 0,
    })),
    top_stakers: (topStakersRes.data ?? []).map((p, i) => ({
      rank:   i + 1,
      wallet: p.wallet_address,
      staked: p.zxp_staked ?? 0,
    })),
    posts_7d:    Object.entries(dayMap7d).map(([date, count]) => ({ date, count })),
    checkins_7d: Object.entries(ciMap7d).map(([date, count]) => ({ date, count })),
    posts_30d:    Object.entries(dayMap30d).map(([date, count]) => ({ date, count })),
    checkins_30d: Object.entries(ciMap30d).map(([date, count]) => ({ date, count })),
    onboarding,
    zxp_supply: (supplyHistoryRes.data ?? []).map(r => ({
      date:        r.date as string,
      circulating: r.circulating as number,
      staked:      r.staked as number,
    })),
  })
}
