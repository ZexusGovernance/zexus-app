import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireAuth, unauthorized } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: marketId } = await params

  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const option = body.option as string
  const amount = Number(body.amount)

  if (!['a', 'b'].includes(option))
    return NextResponse.json({ error: 'option must be "a" or "b"' }, { status: 400 })
  if (!amount || amount < 1 || !Number.isInteger(amount))
    return NextResponse.json({ error: 'amount must be a positive integer' }, { status: 400 })

  const [{ data: market }, { data: profile }] = await Promise.all([
    supabaseAdmin.from('predict_markets').select('*').eq('id', marketId).single(),
    supabaseAdmin.from('profiles').select('zxp_balance').eq('wallet_address', wallet).single(),
  ])

  if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  if (market.status !== 'open')
    return NextResponse.json({ error: 'Market is not open for betting' }, { status: 400 })
  if (new Date(market.closes_at as string) <= new Date())
    return NextResponse.json({ error: 'Market betting period has closed' }, { status: 400 })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const freeBalance = (profile.zxp_balance as number) ?? 0
  if (freeBalance < amount)
    return NextResponse.json({ error: `Insufficient ZXP (have ${freeBalance})` }, { status: 400 })

  // One bet per wallet per market
  const { data: existing } = await supabaseAdmin
    .from('predict_bets')
    .select('id')
    .eq('market_id', marketId)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Already placed a bet on this market' }, { status: 400 })

  const poolField = option === 'a' ? 'pool_a' : 'pool_b'
  const newPool   = ((market[poolField] as number) ?? 0) + amount
  const newBal    = freeBalance - amount

  await Promise.all([
    supabaseAdmin.from('predict_bets').insert({
      market_id:      marketId,
      wallet_address: wallet,
      option,
      amount,
    }),
    supabaseAdmin.from('predict_markets').update({
      [poolField]: newPool,
      updated_at:  new Date().toISOString(),
    }).eq('id', marketId),
    supabaseAdmin.from('profiles').update({
      zxp_balance: newBal,
      updated_at:  new Date().toISOString(),
    }).eq('wallet_address', wallet),
    supabaseAdmin.from('zxp_transactions').insert({
      wallet_address: wallet,
      type:           'predict_bet',
      amount:         -amount,
      note:           `Predict bet — ${option.toUpperCase()} on "${(market.title as string).slice(0, 50)}"`,
      balance_after:  newBal,
    }),
  ])

  const pool_a = option === 'a' ? newPool : (market.pool_a as number) ?? 0
  const pool_b = option === 'b' ? newPool : (market.pool_b as number) ?? 0
  return NextResponse.json({ ok: true, pool_a, pool_b, balance: newBal })
}
