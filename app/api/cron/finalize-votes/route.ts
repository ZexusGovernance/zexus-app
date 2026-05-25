import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const CRON_SECRET       = process.env.CRON_SECRET ?? ''
const MISSED_PENALTY    = -10  // trust score hit when a milestone deadline passes with no submission
const DISPUTED_CAP      = -8   // max penalty for a rejected vote

function calcDisputedDelta(confirmWeight: number, disputeWeight: number): number {
  const total      = confirmWeight + disputeWeight
  const disputePct = total > 0 ? disputeWeight / total : 0
  const linear       = (disputePct - 0.5) / 0.5
  const decisiveness = Math.sqrt(Math.max(0, linear))
  const raw          = Math.round(decisiveness * DISPUTED_CAP)
  return Math.max(DISPUTED_CAP, Math.min(-1, raw))
}

async function getVotesNeeded(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabaseAdmin
    .from('voting_votes')
    .select('wallet_address')
    .gte('created_at', thirtyDaysAgo)
  const unique = new Set((data ?? []).map(r => r.wallet_address)).size
  return Math.max(5, Math.floor(unique * 0.03))
}

async function applyTrustDelta(projectId: string, delta: number, reason: string) {
  const { data: proj } = await supabaseAdmin
    .from('projects').select('trust_score').eq('id', projectId).single()
  if (!proj) return
  const newScore = Math.max(0, Math.min(110, (proj.trust_score as number) + delta))
  await Promise.all([
    supabaseAdmin.from('projects').update({ trust_score: newScore }).eq('id', projectId),
    supabaseAdmin.from('trust_score_log').insert({ project_id: projectId, delta, score_after: newScore, reason }),
  ])
}

// Finalize all voting posts whose deadline has passed
async function finalizeExpiredVotes(): Promise<number> {
  const { data: expiredPosts } = await supabaseAdmin
    .from('posts')
    .select('id, project_id, voting_delta, milestone_id')
    .eq('post_type', 'voting')
    .eq('voting_finalized', false)
    .lt('voting_deadline', new Date().toISOString())

  if (!expiredPosts?.length) return 0

  const votesNeeded = await getVotesNeeded()
  let count = 0

  for (const post of expiredPosts) {
    const { data: voteRows } = await supabaseAdmin
      .from('voting_votes').select('vote, vote_weight').eq('post_id', post.id)

    const all           = voteRows ?? []
    const total         = all.length
    const confirmWeight = all.filter(v => v.vote === 'confirm').reduce((s, v) => s + ((v.vote_weight as number) ?? 1), 0)
    const disputeWeight = all.filter(v => v.vote === 'dispute').reduce((s, v) => s + ((v.vote_weight as number) ?? 1), 0)
    const quorumReached = total >= votesNeeded
    const votePassed    = quorumReached && confirmWeight > disputeWeight
    const delta         = (post.voting_delta as number) ?? 5
    const milestoneId   = post.milestone_id as string | null

    if (milestoneId) {
      if (votePassed) {
        await Promise.all([
          applyTrustDelta(post.project_id as string, delta, 'Milestone confirmed by community vote'),
          supabaseAdmin.from('project_milestones').update({ status: 'completed' }).eq('id', milestoneId),
          supabaseAdmin.from('posts').update({ trust_score_change: delta, voting_finalized: true }).eq('id', post.id),
        ])
      } else if (!quorumReached) {
        await Promise.all([
          applyTrustDelta(post.project_id as string, -1, 'Milestone vote failed — not enough participation'),
          supabaseAdmin.from('project_milestones').update({ status: 'in_progress' }).eq('id', milestoneId),
          supabaseAdmin.from('posts').update({ trust_score_change: -1, voting_finalized: true }).eq('id', post.id),
        ])
      } else {
        const penalty = calcDisputedDelta(confirmWeight, disputeWeight)
        await Promise.all([
          applyTrustDelta(post.project_id as string, penalty, 'Milestone disputed by community vote'),
          supabaseAdmin.from('project_milestones').update({ status: 'disputed' }).eq('id', milestoneId),
          supabaseAdmin.from('posts').update({ trust_score_change: penalty, voting_finalized: true }).eq('id', post.id),
        ])
      }
    } else {
      if (votePassed) {
        const { data: proj } = await supabaseAdmin
          .from('projects').select('trust_score, voting_pts_earned').eq('id', post.project_id).single()
        if (proj) {
          const earned      = (proj.voting_pts_earned as number) ?? 0
          const remaining   = Math.max(0, 10 - earned)
          const actualDelta = Math.min(delta, remaining)
          if (actualDelta > 0) {
            const newScore = Math.max(0, Math.min(110, (proj.trust_score as number) + actualDelta))
            await Promise.all([
              supabaseAdmin.from('projects')
                .update({ trust_score: newScore, voting_pts_earned: earned + actualDelta })
                .eq('id', post.project_id),
              supabaseAdmin.from('trust_score_log').insert({
                project_id: post.project_id, delta: actualDelta,
                score_after: newScore, reason: 'Community vote passed',
              }),
              supabaseAdmin.from('posts').update({ trust_score_change: actualDelta, voting_finalized: true }).eq('id', post.id),
            ])
          } else {
            await supabaseAdmin.from('posts').update({ voting_finalized: true }).eq('id', post.id)
          }
        }
      } else if (!quorumReached) {
        await Promise.all([
          applyTrustDelta(post.project_id as string, -1, 'Community vote failed — not enough participation'),
          supabaseAdmin.from('posts').update({ trust_score_change: -1, voting_finalized: true }).eq('id', post.id),
        ])
      } else {
        const penalty = calcDisputedDelta(confirmWeight, disputeWeight)
        await Promise.all([
          applyTrustDelta(post.project_id as string, penalty, 'Community vote rejected'),
          supabaseAdmin.from('posts').update({ trust_score_change: penalty, voting_finalized: true }).eq('id', post.id),
        ])
      }
    }

    count++
  }

  return count
}

// Apply -10 penalty to milestones that missed their deadline (have a deadline column and are overdue)
async function penalizeMissedMilestones(): Promise<number> {
  const { data: missed } = await supabaseAdmin
    .from('project_milestones')
    .select('id, project_id')
    .in('status', ['upcoming', 'in_progress'])
    .lt('deadline', new Date().toISOString().slice(0, 10))  // date column YYYY-MM-DD

  if (!missed?.length) return 0

  let count = 0
  for (const ms of missed) {
    await Promise.all([
      supabaseAdmin.from('project_milestones')
        .update({ status: 'missed' }).eq('id', ms.id),
      applyTrustDelta(ms.project_id as string, MISSED_PENALTY, 'Milestone deadline missed'),
    ])
    count++
  }

  return count
}

// GET /api/cron/finalize-votes  — called by Vercel Cron every hour
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret') ?? ''
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [votesFinalized, missedPenalized] = await Promise.all([
    finalizeExpiredVotes(),
    penalizeMissedMilestones(),
  ])

  return NextResponse.json({ ok: true, votesFinalized, missedPenalized })
}
