import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { grantOnboardingReward } from '@/lib/onboarding'
import { rankByTotalZxp } from '@/lib/rank'
import { requireAuth, unauthorized } from '@/lib/auth'

// POST /api/profile — upsert profile, return full profile data
export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  const { error: upsertErr } = await supabaseAdmin
    .from('profiles')
    .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true })
  if (upsertErr) console.error('[profile] upsert error:', upsertErr.message)

  // Try full select first (all columns), fall back to ZXP-only, then minimal
  let profile: Record<string, unknown> | null = null
  // Grant connect reward for new users (awaited so widget sees it immediately)
  await grantOnboardingReward(wallet, 'connect')

  for (const cols of [
    'wallet_address, display_name, avatar_url, zxp_balance, zxp_staked, zxp_burned, claim_streak, last_claim_at, settings, telegram_chat_id, registered_at',
    'wallet_address, zxp_balance, zxp_staked, zxp_burned, claim_streak, last_claim_at, settings, registered_at',
    'wallet_address',
  ]) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(cols)
      .eq('wallet_address', wallet)
      .single()
    if (!error && data) { profile = data as unknown as Record<string, unknown>; break }
  }

  if (profile) {
    // Fill in any missing fields with defaults
    profile = {
      display_name: null, avatar_url: null, zxp_balance: 0, zxp_staked: 0, zxp_burned: 0,
      claim_streak: 0, last_claim_at: null, settings: {},
      ...profile,
    }
  }

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Rank by total ZXP (free + staked) so staking never lowers the rank
  const myTotal =
    (((profile as Record<string, unknown>).zxp_balance as number) ?? 0) +
    (((profile as Record<string, unknown>).zxp_staked as number) ?? 0)
  const rank = await rankByTotalZxp(myTotal)

  return NextResponse.json({ profile: { ...profile, rank } })
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

// PATCH /api/profile  { username }  — set a username once. It's permanent:
// once display_name is set it can't be changed, and must be unique.
export async function PATCH(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: { username?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const username = (body.username ?? '').trim()
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: '3–20 characters: letters, numbers, underscore only' },
      { status: 400 },
    )
  }

  // Locked once set
  const { data: current } = await supabaseAdmin
    .from('profiles')
    .select('display_name')
    .eq('wallet_address', wallet)
    .maybeSingle()
  if (current?.display_name) {
    return NextResponse.json({ error: 'Username is already set and cannot be changed' }, { status: 409 })
  }

  // Case-insensitive uniqueness
  const { data: taken } = await supabaseAdmin
    .from('profiles')
    .select('wallet_address')
    .ilike('display_name', username)
    .neq('wallet_address', wallet)
    .maybeSingle()
  if (taken) {
    return NextResponse.json({ error: 'That username is taken' }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ display_name: username, updated_at: new Date().toISOString() })
    .eq('wallet_address', wallet)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, display_name: username })
}
