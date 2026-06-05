import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const VOTING_PTS_CAP       = 10
const DISPUTED_PENALTY_CAP = -8

function timeLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms <= 0) return 'Closed'
  const h = Math.floor(ms / 3600000)
  if (h >= 24) return `${Math.floor(h / 24)}d left`
  if (h >= 1)  return `${h}h left`
  return `${Math.floor(ms / 60000)}m left`
}

// Quorum = min number of unique wallets needed (unchanged)
async function calcVotesNeeded(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabaseAdmin
    .from('voting_votes')
    .select('wallet_address')
    .gte('created_at', thirtyDaysAgo)
  const uniqueVoters = new Set((data ?? []).map(r => r.wallet_address)).size
  return Math.max(5, Math.floor(uniqueVoters * 0.03))
}

function calcDisputedDelta(confirmWeight: number, disputeWeight: number): number {
  const total      = confirmWeight + disputeWeight
  const disputePct = total > 0 ? disputeWeight / total : 0
  const linear       = (disputePct - 0.5) / 0.5
  const decisiveness = Math.sqrt(Math.max(0, linear))
  const raw          = Math.round(decisiveness * DISPUTED_PENALTY_CAP)
  return Math.max(DISPUTED_PENALTY_CAP, Math.min(-1, raw))
}

async function applyAndLog(projectId: string, delta: number, reason: string) {
  const { data: proj } = await supabaseAdmin
    .from('projects').select('trust_score').eq('id', projectId).single()
  if (!proj) return
  const newScore = Math.max(0, Math.min(110, (proj.trust_score as number) + delta))
  await Promise.all([
    supabaseAdmin.from('projects').update({ trust_score: newScore }).eq('id', projectId),
    supabaseAdmin.from('trust_score_log').insert({ project_id: projectId, delta, score_after: newScore, reason }),
  ])
}

async function finalizeVote(
  postId: string,
  projectId: string,
  milestoneId: string | null,
  delta: number,
  total: number,
  confirmWeight: number,
  disputeWeight: number,
  votesNeeded: number,
) {
  const quorumReached = total >= votesNeeded
  // Winner = side with higher total weight (not count)
  const votePassed = quorumReached && confirmWeight > disputeWeight

  if (milestoneId) {
    if (votePassed) {
      await Promise.all([
        supabaseAdmin.from('project_milestones').update({ status: 'completed' }).eq('id', milestoneId),
        applyAndLog(projectId, delta, 'Milestone confirmed by community vote'),
        supabaseAdmin.from('posts').update({ trust_score_change: delta, voting_finalized: true }).eq('id', postId),
      ])
    } else if (!quorumReached) {
      await Promise.all([
        supabaseAdmin.from('project_milestones').update({ status: 'in_progress' }).eq('id', milestoneId),
        applyAndLog(projectId, -1, 'Milestone vote failed — not enough participation'),
        supabaseAdmin.from('posts').update({ trust_score_change: -1, voting_finalized: true }).eq('id', postId),
      ])
    } else {
      const penalty = calcDisputedDelta(confirmWeight, disputeWeight)
      await Promise.all([
        supabaseAdmin.from('project_milestones').update({ status: 'disputed' }).eq('id', milestoneId),
        applyAndLog(projectId, penalty, 'Milestone disputed by community vote'),
        supabaseAdmin.from('posts').update({ trust_score_change: penalty, voting_finalized: true }).eq('id', postId),
      ])
    }
  } else {
    if (votePassed) {
      const { data: proj } = await supabaseAdmin
        .from('projects').select('trust_score, voting_pts_earned').eq('id', projectId).single()
      if (proj) {
        const earned      = (proj.voting_pts_earned as number) ?? 0
        const remaining   = Math.max(0, VOTING_PTS_CAP - earned)
        const actualDelta = Math.min(delta, remaining)
        if (actualDelta > 0) {
          const newScore = Math.max(0, Math.min(110, (proj.trust_score as number) + actualDelta))
          await Promise.all([
            supabaseAdmin.from('projects').update({ trust_score: newScore, voting_pts_earned: earned + actualDelta }).eq('id', projectId),
            supabaseAdmin.from('trust_score_log').insert({ project_id: projectId, delta: actualDelta, score_after: newScore, reason: 'Community vote passed' }),
            supabaseAdmin.from('posts').update({ trust_score_change: actualDelta, voting_finalized: true }).eq('id', postId),
          ])
        } else {
          await supabaseAdmin.from('posts').update({ voting_finalized: true }).eq('id', postId)
        }
      }
    } else if (!quorumReached) {
      await Promise.all([
        applyAndLog(projectId, -1, 'Community vote failed — not enough participation'),
        supabaseAdmin.from('posts').update({ trust_score_change: -1, voting_finalized: true }).eq('id', postId),
      ])
    } else {
      const penalty = calcDisputedDelta(confirmWeight, disputeWeight)
      await Promise.all([
        applyAndLog(projectId, penalty, 'Community vote rejected'),
        supabaseAdmin.from('posts').update({ trust_score_change: penalty, voting_finalized: true }).eq('id', postId),
      ])
    }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase() ?? ''

  const { data: post, error: postErr } = await supabaseAdmin
    .from('posts')
    .select('id, project_id, voting_deadline, voting_finalized, voting_delta, trust_score_change, milestone_id')
    .eq('id', id)
    .eq('post_type', 'voting')
    .maybeSingle()

  if (postErr || !post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const deadline = post.voting_deadline as string | null
  const isOpen   = !!deadline && new Date(deadline) > new Date() && !post.voting_finalized
  const delta    = (post.voting_delta as number) ?? 5

  const { data: voteRows } = await supabaseAdmin
    .from('voting_votes')
    .select('vote, vote_weight, wallet_address, created_at')
    .eq('post_id', id)

  const allVotes     = voteRows ?? []
  const confirmVotes = allVotes.filter(v => v.vote === 'confirm')
  const disputeVotes = allVotes.filter(v => v.vote === 'dispute')
  const confirmCount  = confirmVotes.length
  const disputeCount  = disputeVotes.length
  const total         = allVotes.length

  const confirmWeight = Math.round(confirmVotes.reduce((s, v) => s + ((v.vote_weight as number) ?? 1), 0) * 100) / 100
  const disputeWeight = Math.round(disputeVotes.reduce((s, v) => s + ((v.vote_weight as number) ?? 1), 0) * 100) / 100

  const userVote   = wallet ? (allVotes.find(v => v.wallet_address === wallet)?.vote as 'confirm' | 'dispute' | undefined) : undefined
  const userWeight = wallet ? ((allVotes.find(v => v.wallet_address === wallet)?.vote_weight as number) ?? null) : null

  const votesNeeded = await calcVotesNeeded()

  // Voter list — each voter who enabled "Anonymous voting" is shown as Anonymous.
  const voterWallets = [...new Set(allVotes.map(v => v.wallet_address as string))]
  const { data: voterProfiles } = voterWallets.length
    ? await supabaseAdmin
        .from('profiles')
        .select('wallet_address, display_name, settings')
        .in('wallet_address', voterWallets)
    : { data: [] }
  const vpmap = new Map((voterProfiles ?? []).map(p => [p.wallet_address as string, p]))

  const voters = [...allVotes]
    .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
    .slice(0, 30)
    .map(v => {
      const prof = vpmap.get(v.wallet_address as string)
      const anon = (prof?.settings as Record<string, boolean> | null)?.anonVoting === true
      return {
        vote:   v.vote as 'confirm' | 'dispute',
        anon,
        wallet: anon ? null : (v.wallet_address as string),
        name:   anon ? null : ((prof?.display_name as string) ?? null),
      }
    })

  let passed: boolean | undefined
  let voidResult = false

  if (!isOpen && deadline && !post.voting_finalized) {
    const quorumReached = total >= votesNeeded
    const votePassed    = quorumReached && confirmWeight > disputeWeight
    passed    = votePassed
    voidResult = !quorumReached

    await finalizeVote(
      id,
      post.project_id as string,
      post.milestone_id as string | null,
      delta,
      total,
      confirmWeight,
      disputeWeight,
      votesNeeded,
    )
  } else if (post.voting_finalized) {
    const tsc = post.trust_score_change as number
    passed    = tsc > 0
    voidResult = tsc === -1 && total < votesNeeded
  }

  return NextResponse.json({
    confirmCount,
    disputeCount,
    confirmWeight,
    disputeWeight,
    total,
    votes_needed: votesNeeded,
    isOpen,
    timeLeft: deadline ? timeLeft(deadline) : undefined,
    userVote,
    userWeight,
    passed,
    void: voidResult,
    voters,
  })
}
