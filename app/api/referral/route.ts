import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { notifyWallet } from '@/lib/telegram'
import { requireAuth, unauthorized } from '@/lib/auth'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/
const REFERRER_REWARD_ZXP = 5

// GET /api/referral?wallet=0x...  → referral count + list
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  if (!WALLET_RE.test(wallet)) {
    return NextResponse.json({ count: 0, referrals: [] })
  }

  const { data, count } = await supabaseAdmin
    .from('referrals')
    .select('referred_wallet, created_at, rewarded', { count: 'exact' })
    .eq('referrer_wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ count: count ?? 0, referrals: data ?? [] })
}

// POST /api/referral  { referred_wallet, referrer_wallet }
// Called once when a new user first connects with a ref= code.
export async function POST(req: NextRequest) {
  const referred = requireAuth(req)
  if (!referred) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const referrer = (body.referrer_wallet as string)?.toLowerCase().trim()

  if (!referrer  || !WALLET_RE.test(referrer))
    return NextResponse.json({ error: 'Invalid referrer_wallet' }, { status: 400 })
  if (referred === referrer)
    return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })

  // Idempotent: referred user can only have one referrer
  const { error } = await supabaseAdmin
    .from('referrals')
    .insert({ referrer_wallet: referrer, referred_wallet: referred })

  if (error) {
    // unique constraint violation → already referred
    if (error.code === '23505') return NextResponse.json({ ok: true, already: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Give referrer a reward immediately
  const { data: prof } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance')
    .eq('wallet_address', referrer)
    .maybeSingle()

  if (prof) {
    const newBal = (prof.zxp_balance as number) + REFERRER_REWARD_ZXP
    await Promise.all([
      supabaseAdmin.from('profiles')
        .update({ zxp_balance: newBal, updated_at: new Date().toISOString() })
        .eq('wallet_address', referrer),
      supabaseAdmin.from('zxp_transactions').insert({
        wallet_address: referrer,
        type:           'referral',
        amount:         REFERRER_REWARD_ZXP,
        note:           `Referral reward — invited ${referred.slice(0, 6)}…${referred.slice(-4)}`,
        balance_after:  newBal,
      }),
    ])
    void notifyWallet(referrer,
      `👥 <b>+${REFERRER_REWARD_ZXP} ZXP</b> — Referral reward!\n` +
      `${referred.slice(0, 6)}…${referred.slice(-4)} joined Zexus via your link.\n\n` +
      `<a href="https://app.zexus.xyz">Open Zexus</a>`,
    )
  }

  return NextResponse.json({ ok: true })
}
