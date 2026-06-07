import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { notifyWallet } from '@/lib/telegram'
import { requireAuth, unauthorized } from '@/lib/auth'

// One-time welcome bonus of 10 ZXP, claimable once per wallet.
const BONUS_AMOUNT = 10
const BONUS_TYPE = 'welcome_bonus'

async function alreadyClaimed(wallet: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('zxp_transactions')
    .select('id')
    .eq('wallet_address', wallet)
    .eq('type', BONUS_TYPE)
    .maybeSingle()
  return !!data
}

// GET /api/zxp/bonus?wallet=0x... — has this wallet claimed the bonus?
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim()
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ claimed: false, amount: BONUS_AMOUNT })
  }
  return NextResponse.json({ claimed: await alreadyClaimed(wallet), amount: BONUS_AMOUNT })
}

export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  // Idempotency: only one welcome bonus per wallet, ever.
  if (await alreadyClaimed(wallet)) {
    return NextResponse.json({ already_claimed: true, amount: BONUS_AMOUNT })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance')
    .eq('wallet_address', wallet)
    .single()

  const newBalance = (profile?.zxp_balance ?? 0) + BONUS_AMOUNT

  await supabaseAdmin
    .from('profiles')
    .update({ zxp_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('wallet_address', wallet)

  await supabaseAdmin.from('zxp_transactions').insert({
    wallet_address: wallet,
    type: BONUS_TYPE,
    amount: BONUS_AMOUNT,
    note: 'Welcome bonus',
    balance_after: newBalance,
  })

  void notifyWallet(wallet,
    `🎁 <b>+${BONUS_AMOUNT} ZXP</b> — Welcome bonus\n` +
    `Balance: ${newBalance} ZXP\n\n` +
    `<a href="https://app.zexus.xyz">Open Zexus</a>`,
    'notifZxp',
  )

  return NextResponse.json({ ok: true, amount: BONUS_AMOUNT, balance: newBalance })
}
