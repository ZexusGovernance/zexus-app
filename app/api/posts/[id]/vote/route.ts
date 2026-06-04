import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireAuth, unauthorized } from '@/lib/auth'
import { getBurnPool } from '@/lib/burnPool'

const MIN_STAKED    = 10   // raised from 5 — 7 ZXP onboarding rewards aren't enough to vote
const MIN_AGE_HOURS = 48

function timeBonus(maxDaysStaked: number): number {
  if (maxDaysStaked >= 365) return 2.2
  if (maxDaysStaked >= 180) return 1.8
  if (maxDaysStaked >= 90)  return 1.5
  if (maxDaysStaked >= 30)  return 1.2
  return 1.0
}

function calcWeight(zxpStaked: number, maxDaysStaked: number): number {
  return Math.round(Math.sqrt(zxpStaked) * timeBonus(maxDaysStaked) * 100) / 100
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const walletLower = requireAuth(req)
  if (!walletLower) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { vote } = body
  if (vote !== 'confirm' && vote !== 'dispute') return NextResponse.json({ error: 'vote must be confirm or dispute' }, { status: 400 })

  const [{ data: profile }, { data: positions }, { data: epochCfg }, { data: existingVote }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('zxp_staked, zxp_balance, zxp_burned, registered_at')
      .eq('wallet_address', walletLower)
      .maybeSingle(),
    supabaseAdmin
      .from('staking_positions')
      .select('staked_at, amount')
      .eq('wallet_address', walletLower)
      .eq('status', 'active'),
    supabaseAdmin
      .from('epoch_config')
      .select('vote_burn_cost')
      .eq('id', 1)
      .single(),
    supabaseAdmin
      .from('voting_votes')
      .select('id')
      .eq('post_id', id)
      .eq('wallet_address', walletLower)
      .maybeSingle(),
  ])

  if (!profile) return NextResponse.json({ error: 'Connect your wallet first to vote' }, { status: 403 })

  const staked = profile.zxp_staked as number
  if (staked < MIN_STAKED)
    return NextResponse.json({ error: `You need at least ${MIN_STAKED} ZXP staked to vote` }, { status: 403 })

  const accountAgeHours = profile.registered_at
    ? (Date.now() - new Date(profile.registered_at as string).getTime()) / 3_600_000
    : 0
  if (accountAgeHours < MIN_AGE_HOURS) {
    const hoursLeft = Math.ceil(MIN_AGE_HOURS - accountAgeHours)
    return NextResponse.json({ error: `Your account is too new to vote — wait ${hoursLeft}h more` }, { status: 403 })
  }

  const burnCost    = (epochCfg?.vote_burn_cost as number) ?? 1
  const freeBalance = (profile.zxp_balance as number) ?? 0
  const isNewVote   = !existingVote

  // Only first-time votes cost ZXP (changing vote is free)
  if (isNewVote && freeBalance < burnCost) {
    return NextResponse.json({
      error: `Voting costs ${burnCost} ZXP. You have ${freeBalance} free ZXP — check in daily to earn more.`,
    }, { status: 403 })
  }

  // Weighted-average age across all positions (by amount) — prevents anchoring
  // a tiny old position to get max timeBonus on a large new stake.
  const posArr = positions ?? []
  const totalPositionAmount = posArr.reduce((s, p) => s + (p.amount as number), 0)
  const weightedAvgDays = totalPositionAmount > 0
    ? posArr.reduce((s, p) => {
        const days = (Date.now() - new Date(p.staked_at as string).getTime()) / 86_400_000
        return s + days * (p.amount as number)
      }, 0) / totalPositionAmount
    : 0

  // Community Burn Pool: everyone's vote weight gets the active monthly bonus
  const { bonus: communityBonus } = await getBurnPool()
  const voteWeight = Math.round(calcWeight(staked, weightedAvgDays) * (1 + communityBonus) * 100) / 100

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('id, voting_deadline, voting_finalized')
    .eq('id', id)
    .eq('post_type', 'voting')
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'Voting post not found' }, { status: 404 })
  if (post.voting_finalized) return NextResponse.json({ error: 'This vote has already closed' }, { status: 400 })
  if (!post.voting_deadline || new Date(post.voting_deadline as string) <= new Date())
    return NextResponse.json({ error: 'Voting period has ended' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('voting_votes')
    .upsert(
      { post_id: id, wallet_address: walletLower, vote, vote_weight: voteWeight },
      { onConflict: 'post_id,wallet_address' },
    )

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })

  // Burn ZXP only on first vote (changing vote costs nothing)
  if (isNewVote && burnCost > 0) {
    const newBalance = freeBalance - burnCost
    const newBurned  = ((profile.zxp_burned as number) ?? 0) + burnCost
    await Promise.all([
      supabaseAdmin.from('profiles')
        .update({ zxp_balance: newBalance, zxp_burned: newBurned, updated_at: new Date().toISOString() })
        .eq('wallet_address', walletLower),
      supabaseAdmin.from('zxp_transactions').insert({
        wallet_address: walletLower,
        type:           'burn',
        amount:         -burnCost,
        note:           'Community vote cast',
        balance_after:  newBalance,
      }),
    ])
  }

  const { data: votes } = await supabaseAdmin
    .from('voting_votes')
    .select('vote, vote_weight')
    .eq('post_id', id)

  const all           = votes ?? []
  const confirmCount  = all.filter(v => v.vote === 'confirm').length
  const disputeCount  = all.filter(v => v.vote === 'dispute').length
  const confirmWeight = all.filter(v => v.vote === 'confirm').reduce((s, v) => s + (v.vote_weight as number), 0)
  const disputeWeight = all.filter(v => v.vote === 'dispute').reduce((s, v) => s + (v.vote_weight as number), 0)

  return NextResponse.json({
    ok: true,
    confirmCount,
    disputeCount,
    confirmWeight: Math.round(confirmWeight * 100) / 100,
    disputeWeight: Math.round(disputeWeight * 100) / 100,
    total:         all.length,
    userVote:      vote,
    userWeight:    voteWeight,
  })
}
