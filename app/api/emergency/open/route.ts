import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { notifyProjectEmergency } from '@/lib/notify'
import { effectiveEmergencyConfig } from '@/lib/emergency-config'
import { adjustTrust, PROVISIONAL_ALERT_TS } from '@/lib/emergency'
import { requireAuth, unauthorized } from '@/lib/auth'

const COLLECT_HOURS          = 48
const INITIATOR_COOLDOWN_DAYS = 14

// Outcome-based project cooldown (days) before a NEW call can be opened.
// A flat lockout is dangerous: a project could rug during it. So the cooldown
// scales with the last outcome — false alarms get a real anti-harassment delay,
// but genuinely-unresolved (ignored) cases let the community re-escalate at once.
const PROJECT_COOLDOWN_DAYS: Record<string, number> = {
  false_alarm: 30,  // was baseless — deter harassment
  resolved:    7,   // real but handled — short breather
  ignored:     0,   // real and neglected — re-escalate immediately
}
// Below this Trust Score a project is openly distrusted and gets no cooldown shield.
const COOLDOWN_TRUST_FLOOR = 20

export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const project_id = body.project_id as string
  const reason     = (body.reason as string)?.trim()
  const amount     = Number(body.amount)

  if (!project_id)
    return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  if (!reason || reason.length < 10)
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })

  // ── Load epoch config ──────────────────────────────────────────────────────
  const { data: epochCfg } = await supabaseAdmin
    .from('epoch_config')
    .select('scale_factor')
    .eq('id', 1)
    .single()

  const { pool_goal, max_amount, min_amount } = effectiveEmergencyConfig(
    (epochCfg?.scale_factor as number) ?? 1,
  )

  if (!amount || amount < min_amount || amount > max_amount || !Number.isInteger(amount))
    return NextResponse.json({ error: `Amount must be ${min_amount}–${max_amount} ZXP` }, { status: 400 })

  // ── 1. Validate wallet requirements ────────────────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance, zxp_staked, registered_at')
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Connect your wallet first' }, { status: 403 })

  if ((profile.zxp_staked as number) < 5)
    return NextResponse.json({ error: 'You need at least 5 ZXP staked to raise an Emergency Call' }, { status: 403 })

  const accountAgeDays = (Date.now() - new Date(profile.registered_at as string).getTime()) / 86_400_000
  if (accountAgeDays < 14)
    return NextResponse.json({ error: `Account must be at least 14 days old (${Math.ceil(14 - accountAgeDays)}d left)` }, { status: 403 })

  if ((profile.zxp_balance as number) < amount)
    return NextResponse.json({ error: `Not enough free ZXP (have ${profile.zxp_balance})` }, { status: 400 })

  // ── 2. Watchlist ≥ 3 days ─────────────────────────────────────────────────
  const { data: wl } = await supabaseAdmin
    .from('user_watchlist')
    .select('added_at')
    .eq('wallet_address', wallet)
    .eq('project_id', project_id)
    .maybeSingle()

  if (!wl) return NextResponse.json({ error: 'You must have this project in your watchlist to raise an Emergency Call' }, { status: 403 })

  const watchDays = (Date.now() - new Date(wl.added_at as string).getTime()) / 86_400_000
  if (watchDays < 3)
    return NextResponse.json({ error: `You need to watch this project for at least 3 days (${Math.ceil(3 - watchDays)}d left)` }, { status: 403 })

  // ── 3. Participation limit: < 2 in last 30 days ───────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { count: recentCount } = await supabaseAdmin
    .from('emergency_participants')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
    .gte('joined_at', thirtyDaysAgo)

  if ((recentCount ?? 0) >= 2)
    return NextResponse.json({ error: 'You can only participate in 2 Emergency Calls per month' }, { status: 429 })

  // ── 4. Initiator cooldown: no false_alarm in last 14 days ────────────────
  const initiatorCooldown = new Date(Date.now() - INITIATOR_COOLDOWN_DAYS * 86_400_000).toISOString()
  const { data: recentFalse } = await supabaseAdmin
    .from('emergency_calls')
    .select('id')
    .eq('initiator_wallet', wallet)
    .eq('status', 'false_alarm')
    .gte('resolved_at', initiatorCooldown)
    .limit(1)
    .maybeSingle()

  if (recentFalse)
    return NextResponse.json({ error: 'You raised a false alarm recently — wait 14 days before opening another Emergency Call' }, { status: 429 })

  // ── 5. Project: no active call, no cooldown ───────────────────────────────
  const { data: activeCall } = await supabaseAdmin
    .from('emergency_calls')
    .select('id')
    .eq('project_id', project_id)
    .in('status', ['collecting', 'active'])
    .limit(1)
    .maybeSingle()

  if (activeCall)
    return NextResponse.json({ error: 'This project already has an active Emergency Call' }, { status: 409 })

  // Low-trust projects are openly distrusted — no cooldown shield for them
  const { data: projRow } = await supabaseAdmin
    .from('projects').select('trust_score').eq('id', project_id).single()
  const trustScore = (projRow?.trust_score as number) ?? 100

  if (trustScore >= COOLDOWN_TRUST_FLOOR) {
    const { data: lastResolved } = await supabaseAdmin
      .from('emergency_calls')
      .select('status, resolved_at')
      .eq('project_id', project_id)
      .in('status', ['false_alarm', 'resolved', 'ignored'])
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastResolved?.resolved_at) {
      const days = PROJECT_COOLDOWN_DAYS[lastResolved.status as string] ?? 0
      const cooldownEnds = new Date(new Date(lastResolved.resolved_at as string).getTime() + days * 86_400_000)
      if (days > 0 && cooldownEnds > new Date()) {
        const daysLeft = Math.ceil((cooldownEnds.getTime() - Date.now()) / 86_400_000)
        return NextResponse.json({
          error: `This project's last Emergency Call (${lastResolved.status}) is on a ${days}-day cooldown — ${daysLeft}d left`,
        }, { status: 429 })
      }
    }
  }

  // ── 6. Create call + deduct ZXP ───────────────────────────────────────────
  const collectingUntil = new Date(Date.now() + COLLECT_HOURS * 3_600_000).toISOString()

  const { data: call, error: callErr } = await supabaseAdmin
    .from('emergency_calls')
    .insert({
      project_id,
      initiator_wallet:  wallet,
      reason,
      pool_zxp:          amount,
      participant_count: 1,
      collecting_until:  collectingUntil,
    })
    .select('id, status, pool_zxp, participant_count, collecting_until')
    .single()

  if (callErr) return NextResponse.json({ error: 'Database error' }, { status: 500 })

  await supabaseAdmin
    .from('emergency_participants')
    .insert({ call_id: call.id, wallet_address: wallet, amount })

  await supabaseAdmin
    .from('profiles')
    .update({ zxp_balance: (profile.zxp_balance as number) - amount })
    .eq('wallet_address', wallet)

  // Auto-activate if single person hits pool goal (unlikely but handled)
  const autoActivated = amount >= pool_goal
  if (autoActivated) {
    const responseUntil = new Date(Date.now() + COLLECT_HOURS * 3_600_000).toISOString()
    await supabaseAdmin
      .from('emergency_calls')
      .update({ status: 'active', response_until: responseUntil })
      .eq('id', call.id)
    // Fast lane: provisional Trust Score drop on activation (reversed at resolution)
    await adjustTrust(project_id, -PROVISIONAL_ALERT_TS, 'Emergency Call active — provisional review')
  }

  // Notify watchlist followers (in-app + Telegram) — fire-and-forget
  void (async () => {
    const { data: proj } = await supabaseAdmin
      .from('projects').select('name').eq('id', project_id).maybeSingle()
    const projName = (proj?.name as string) ?? 'a project'
    const snippet = `${reason.slice(0, 120)}${reason.length > 120 ? '…' : ''}`
    void notifyProjectEmergency({
      projectId: project_id,
      title: autoActivated
        ? `Emergency Call ACTIVE — ${projName}`
        : `Emergency Call opened — ${projName}`,
      body: autoActivated
        ? `${snippet} Trust Score lowered pending verdict.`
        : `${snippet} Pool goal: ${pool_goal} ZXP from ≥5 wallets within 48h.`,
    })
  })()

  return NextResponse.json({ ok: true, call })
}
