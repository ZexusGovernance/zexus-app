import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { ACHIEVEMENTS, type AchievementStats } from '@/lib/achievements'
import { notifyWallet } from '@/lib/telegram'
import { requireAuth, unauthorized } from '@/lib/auth'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// GET /api/achievements?wallet=0x...
// Returns all achievements with unlocked/claimed status.
// Side-effect: sends TG notification for newly unlockable achievements.
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  if (!WALLET_RE.test(wallet)) {
    return NextResponse.json({ achievements: [] })
  }

  const [profileRes, verdictsRes, referralsRes, claimedRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('zxp_balance, zxp_staked, claim_streak')
      .eq('wallet_address', wallet)
      .maybeSingle(),
    supabaseAdmin
      .from('voting_votes')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_address', wallet),
    supabaseAdmin
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_wallet', wallet),
    supabaseAdmin
      .from('claimed_achievements')
      .select('achievement_id, notified_at, claimed_at')
      .eq('wallet_address', wallet),
  ])

  const profile = profileRes.data
  const stats: AchievementStats = {
    verdicts:     verdictsRes.count  ?? 0,
    zxp_staked:   (profile?.zxp_staked  as number) ?? 0,
    claim_streak: (profile?.claim_streak as number) ?? 0,
    zxp_balance:  (profile?.zxp_balance as number) ?? 0,
    referrals:    referralsRes.count ?? 0,
  }

  const claimedMap = new Map(
    (claimedRes.data ?? []).map(r => [r.achievement_id as string, r]),
  )

  const newlyUnlocked: string[] = []
  const results = ACHIEVEMENTS.map(a => {
    const unlocked = a.check(stats)
    const record   = claimedMap.get(a.id)
    const claimed  = !!record?.claimed_at
    const notified = !!record?.notified_at

    if (unlocked && !notified) newlyUnlocked.push(a.id)

    return {
      id:         a.id,
      name:       a.name,
      desc:       a.desc,
      icon:       a.icon,
      iconColor:  a.iconColor,
      badgeLabel: a.badgeLabel,
      unlocked,
      claimed,
      progress: a.progress ? a.progress(stats) : null,
    }
  })

  // Mark newly unlocked as notified + send TG (fire-and-forget)
  if (newlyUnlocked.length > 0) {
    void (async () => {
      await Promise.all(
        newlyUnlocked.map(id =>
          supabaseAdmin.from('claimed_achievements').upsert(
            { wallet_address: wallet, achievement_id: id, notified_at: new Date().toISOString() },
            { onConflict: 'wallet_address,achievement_id', ignoreDuplicates: false },
          ),
        ),
      )
      const names = newlyUnlocked
        .map(id => ACHIEVEMENTS.find(a => a.id === id))
        .filter(Boolean)
        .map(a => `🏅 <b>${a!.name}</b>`)
        .join('\n')
      void notifyWallet(wallet,
        `🎉 New badge${newlyUnlocked.length > 1 ? 's' : ''} ready to claim!\n\n` +
        `${names}\n\n` +
        `Go to your profile → Activity to claim your badge.\n` +
        `<a href="https://app.zexus.xyz">Open Zexus</a>`,
        'notifZxp',
      )
    })()
  }

  return NextResponse.json({ achievements: results, stats })
}

// POST /api/achievements  { wallet, achievement_id }
// Marks the badge as claimed — no ZXP is awarded, the badge itself is the reward.
export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const achievement_id = body.achievement_id as string

  if (!achievement_id)
    return NextResponse.json({ error: 'achievement_id required' }, { status: 400 })

  const ach = ACHIEVEMENTS.find(a => a.id === achievement_id)
  if (!ach) return NextResponse.json({ error: 'Unknown achievement' }, { status: 404 })

  // Check not already claimed
  const { data: existing } = await supabaseAdmin
    .from('claimed_achievements')
    .select('claimed_at')
    .eq('wallet_address', wallet)
    .eq('achievement_id', achievement_id)
    .maybeSingle()

  if (existing?.claimed_at)
    return NextResponse.json({ error: 'Already claimed' }, { status: 409 })

  // Verify achievement is actually unlocked
  const [profileRes, verdictsRes, referralsRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('zxp_balance, zxp_staked, claim_streak').eq('wallet_address', wallet).maybeSingle(),
    supabaseAdmin.from('voting_votes').select('*', { count: 'exact', head: true }).eq('wallet_address', wallet),
    supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_wallet', wallet),
  ])

  const profile = profileRes.data
  const stats: AchievementStats = {
    verdicts:     verdictsRes.count  ?? 0,
    zxp_staked:   (profile?.zxp_staked  as number) ?? 0,
    claim_streak: (profile?.claim_streak as number) ?? 0,
    zxp_balance:  (profile?.zxp_balance as number) ?? 0,
    referrals:    referralsRes.count ?? 0,
  }

  if (!ach.check(stats))
    return NextResponse.json({ error: 'Achievement not yet unlocked' }, { status: 403 })

  // Record claim — badge only, no ZXP disbursed
  await supabaseAdmin.from('claimed_achievements').upsert(
    {
      wallet_address: wallet,
      achievement_id,
      claimed_at:  new Date().toISOString(),
      notified_at: new Date().toISOString(),
      zxp_earned:  0,
    },
    { onConflict: 'wallet_address,achievement_id' },
  )

  return NextResponse.json({ ok: true, badge: ach.badgeLabel })
}
