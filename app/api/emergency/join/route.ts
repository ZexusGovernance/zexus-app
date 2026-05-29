import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { notifyWallet, notifyProjectWatchers } from '@/lib/telegram'
import { effectiveEmergencyConfig } from '@/lib/emergency-config'
import { requireAuth, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const call_id = body.call_id as string
  const amount  = Number(body.amount)

  if (!call_id)
    return NextResponse.json({ error: 'call_id required' }, { status: 400 })

  // ── Load epoch config ──────────────────────────────────────────────────────
  const { data: epochCfg } = await supabaseAdmin
    .from('epoch_config')
    .select('scale_factor')
    .eq('id', 1)
    .single()

  const { pool_goal, max_amount, min_amount, min_wallets } = effectiveEmergencyConfig(
    (epochCfg?.scale_factor as number) ?? 1,
  )

  if (!amount || amount < min_amount || amount > max_amount || !Number.isInteger(amount))
    return NextResponse.json({ error: `Amount must be ${min_amount}–${max_amount} ZXP` }, { status: 400 })

  // ── 1. Load call ─────────────────────────────────────────────────────────────
  const { data: call } = await supabaseAdmin
    .from('emergency_calls')
    .select('id, project_id, status, pool_zxp, participant_count, collecting_until, initiator_wallet')
    .eq('id', call_id)
    .maybeSingle()

  if (!call)
    return NextResponse.json({ error: 'Emergency Call not found' }, { status: 404 })
  if (call.status !== 'collecting')
    return NextResponse.json({ error: 'This Emergency Call is no longer accepting participants' }, { status: 409 })
  if (new Date(call.collecting_until as string) < new Date())
    return NextResponse.json({ error: 'The collection window for this call has closed' }, { status: 409 })
  if ((call.initiator_wallet as string) === wallet)
    return NextResponse.json({ error: 'You already opened this Emergency Call' }, { status: 409 })

  // ── 2. Validate wallet requirements ──────────────────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance, zxp_staked, registered_at')
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Connect your wallet first' }, { status: 403 })

  if ((profile.zxp_staked as number) < 5)
    return NextResponse.json({ error: 'You need at least 5 ZXP staked to join an Emergency Call' }, { status: 403 })

  const accountAgeDays = (Date.now() - new Date(profile.registered_at as string).getTime()) / 86_400_000
  if (accountAgeDays < 14)
    return NextResponse.json({ error: `Account must be at least 14 days old (${Math.ceil(14 - accountAgeDays)}d left)` }, { status: 403 })

  if ((profile.zxp_balance as number) < amount)
    return NextResponse.json({ error: `Not enough free ZXP (have ${profile.zxp_balance})` }, { status: 400 })

  // ── 3. Watchlist ≥ 3 days ────────────────────────────────────────────────────
  const { data: wl } = await supabaseAdmin
    .from('user_watchlist')
    .select('added_at')
    .eq('wallet_address', wallet)
    .eq('project_id', call.project_id)
    .maybeSingle()

  if (!wl)
    return NextResponse.json({ error: 'You must have this project in your watchlist to join an Emergency Call' }, { status: 403 })

  const watchDays = (Date.now() - new Date(wl.added_at as string).getTime()) / 86_400_000
  if (watchDays < 3)
    return NextResponse.json({ error: `You need to watch this project for at least 3 days (${Math.ceil(3 - watchDays)}d left)` }, { status: 403 })

  // ── 4. Participation limit: < 2 in last 30 days ───────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { count: recentCount } = await supabaseAdmin
    .from('emergency_participants')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
    .gte('joined_at', thirtyDaysAgo)

  if ((recentCount ?? 0) >= 2)
    return NextResponse.json({ error: 'You can only participate in 2 Emergency Calls per month' }, { status: 429 })

  // ── 5. Not already in this call ──────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('emergency_participants')
    .select('id')
    .eq('call_id', call_id)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (existing)
    return NextResponse.json({ error: 'You have already joined this Emergency Call' }, { status: 409 })

  // ── 6. Insert participant + deduct ZXP ────────────────────────────────────────
  await supabaseAdmin
    .from('emergency_participants')
    .insert({ call_id, wallet_address: wallet, amount })

  await supabaseAdmin
    .from('profiles')
    .update({ zxp_balance: (profile.zxp_balance as number) - amount })
    .eq('wallet_address', wallet)

  const newPool  = (call.pool_zxp as number) + amount
  const newCount = (call.participant_count as number) + 1
  const shouldActivate = newPool >= pool_goal && newCount >= min_wallets

  if (shouldActivate) {
    const responseUntil = new Date(Date.now() + 48 * 3_600_000).toISOString()
    await supabaseAdmin
      .from('emergency_calls')
      .update({ pool_zxp: newPool, participant_count: newCount, status: 'active', response_until: responseUntil })
      .eq('id', call_id)

    // Notify all watchers + project admin that call is now ACTIVE (fire-and-forget)
    void (async () => {
      const { data: proj } = await supabaseAdmin
        .from('projects')
        .select('name, admin_wallet')
        .eq('id', call.project_id as string)
        .maybeSingle()
      const projName = (proj?.name as string) ?? 'a project'
      const activatedText =
        `🚨 <b>Emergency Call ACTIVE — ${projName}</b>\n` +
        `Pool goal reached (${newPool} ZXP · ${newCount} wallets).\n` +
        `The project has <b>48 hours</b> to respond.\n\n` +
        `<a href="https://app.zexus.xyz">Open Zexus</a>`
      void notifyProjectWatchers(call.project_id as string, activatedText)
      if (proj?.admin_wallet) {
        void notifyWallet(proj.admin_wallet as string,
          `🚨 <b>Emergency Call against ${projName} is now ACTIVE</b>\n` +
          `Community raised ${newPool} ZXP from ${newCount} wallets.\n` +
          `You have <b>48 hours</b> to respond publicly.\n\n` +
          `<a href="https://app.zexus.xyz">Open Zexus</a>`,
        )
      }
    })()
  } else {
    await supabaseAdmin
      .from('emergency_calls')
      .update({ pool_zxp: newPool, participant_count: newCount })
      .eq('id', call_id)
  }

  return NextResponse.json({ ok: true, activated: shouldActivate, pool_zxp: newPool, participant_count: newCount })
}
