import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { STAKING_MILESTONES } from '@/lib/staking-milestones'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// GET /api/zxp/milestones?wallet=0x...
// Returns all milestone states for each active position
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  if (!WALLET_RE.test(wallet)) return NextResponse.json({ milestones: [] })

  const [{ data: positions }, { data: claims }] = await Promise.all([
    supabaseAdmin
      .from('staking_positions')
      .select('id, amount, staked_at')
      .eq('wallet_address', wallet)
      .eq('status', 'active'),
    supabaseAdmin
      .from('staking_milestone_claims')
      .select('position_id, milestone_days, zxp_awarded, claimed_at')
      .eq('wallet_address', wallet),
  ])

  const claimSet = new Set(
    (claims ?? []).map(c => `${c.position_id}:${c.milestone_days}`),
  )

  const result = (positions ?? []).flatMap(pos => {
    const daysStaked = (Date.now() - new Date(pos.staked_at as string).getTime()) / 86_400_000

    return STAKING_MILESTONES
      .filter(m => pos.amount >= m.minAmount)
      .map(m => {
        const key     = `${pos.id}:${m.days}`
        const reached = daysStaked >= m.days
        const claimed = claimSet.has(key)
        return {
          position_id:   pos.id,
          milestone_days: m.days,
          min_amount:    m.minAmount,
          reward:        m.reward,
          reached,
          claimed,
          claimable:     reached && !claimed,
          days_staked:   Math.floor(daysStaked),
          position_amount: pos.amount,
        }
      })
  })

  return NextResponse.json({ milestones: result })
}

// POST /api/zxp/milestones  { wallet, position_id, milestone_days }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wallet        = (body.wallet as string)?.toLowerCase().trim()
  const positionId    = body.position_id as string
  const milestoneDays = Number(body.milestone_days)

  if (!wallet || !WALLET_RE.test(wallet))
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
  if (!positionId)
    return NextResponse.json({ error: 'position_id required' }, { status: 400 })

  const milestone = STAKING_MILESTONES.find(m => m.days === milestoneDays)
  if (!milestone)
    return NextResponse.json({ error: 'Unknown milestone' }, { status: 400 })

  // Validate position belongs to wallet and is active
  const { data: pos } = await supabaseAdmin
    .from('staking_positions')
    .select('id, amount, staked_at, status')
    .eq('id', positionId)
    .eq('wallet_address', wallet)
    .eq('status', 'active')
    .maybeSingle()

  if (!pos)
    return NextResponse.json({ error: 'Position not found or not active' }, { status: 404 })

  if ((pos.amount as number) < milestone.minAmount)
    return NextResponse.json({
      error: `This milestone requires at least ${milestone.minAmount} ZXP staked`,
    }, { status: 403 })

  const daysStaked = (Date.now() - new Date(pos.staked_at as string).getTime()) / 86_400_000
  if (daysStaked < milestone.days)
    return NextResponse.json({
      error: `Need ${milestone.days} days staked — you have ${Math.floor(daysStaked)}d`,
    }, { status: 403 })

  // Idempotency: already claimed?
  const { data: existing } = await supabaseAdmin
    .from('staking_milestone_claims')
    .select('id')
    .eq('position_id', positionId)
    .eq('milestone_days', milestoneDays)
    .maybeSingle()

  if (existing)
    return NextResponse.json({ error: 'Already claimed' }, { status: 409 })

  // Record claim
  const { error: claimErr } = await supabaseAdmin
    .from('staking_milestone_claims')
    .insert({ wallet_address: wallet, position_id: positionId, milestone_days: milestoneDays, zxp_awarded: milestone.reward })

  if (claimErr)
    return NextResponse.json({ error: claimErr.message }, { status: 500 })

  // Credit balance
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance')
    .eq('wallet_address', wallet)
    .single()

  const newBalance = ((profile?.zxp_balance as number) ?? 0) + milestone.reward

  await Promise.all([
    supabaseAdmin
      .from('profiles')
      .update({ zxp_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('wallet_address', wallet),
    supabaseAdmin.from('zxp_transactions').insert({
      wallet_address: wallet,
      type:           'reward',
      amount:         milestone.reward,
      note:           `Staking milestone: ${milestone.days}d with ≥${milestone.minAmount} ZXP`,
      balance_after:  newBalance,
    }),
  ])

  return NextResponse.json({ ok: true, zxp_awarded: milestone.reward, balance: newBalance })
}
