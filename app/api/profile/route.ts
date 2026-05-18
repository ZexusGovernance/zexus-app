import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// POST /api/profile — upsert profile, return full profile data
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wallet = (body.wallet as string)?.toLowerCase().trim()
  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
  }

  const { error: upsertErr } = await supabaseAdmin
    .from('profiles')
    .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true })
  if (upsertErr) console.error('[profile] upsert error:', upsertErr.message)

  // Try full select first (all columns), fall back to ZXP-only, then minimal
  let profile: Record<string, unknown> | null = null
  for (const cols of [
    'wallet_address, display_name, avatar_url, zxp_balance, zxp_staked, claim_streak, last_claim_at, settings',
    'wallet_address, zxp_balance, zxp_staked, claim_streak, last_claim_at, settings',
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
      display_name: null, avatar_url: null, zxp_balance: 0, zxp_staked: 0,
      claim_streak: 0, last_claim_at: null, settings: {},
      ...profile,
    }
  }

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const zxp = ((profile as Record<string, unknown>).zxp_balance as number) ?? 0
  let count = 0
  try {
    const { count: c } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gt('zxp_balance', zxp)
    count = c ?? 0
  } catch { /* ignore */ }

  return NextResponse.json({ profile: { ...profile, rank: (count ?? 0) + 1 } })
}
