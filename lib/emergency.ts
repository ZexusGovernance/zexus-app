import { supabaseAdmin } from '@/lib/supabase-server'
import { EMERGENCY_VERDICT_TITLE, EMERGENCY_RESPONSE_TITLE } from '@/lib/emergency-labels'

export { EMERGENCY_VERDICT_TITLE, EMERGENCY_RESPONSE_TITLE }

// ═══════════════════════════════════════════════════════════════════════════
// Emergency Call → community-verdict adjudication.
//
// When a call's 48h response window elapses it is converted into a stake-
// weighted community vote (a system-authored `voting` post). The existing
// finalize-votes cron closes that vote and maps the result to an outcome.
// Nobody — not the project, not the Zexus team — decides unilaterally; the
// staked community does. The manual /api/emergency/resolve endpoint remains
// as a last-resort backstop only.
// ═══════════════════════════════════════════════════════════════════════════

// A reserved, non-custodial pseudo-wallet that authors verdict votes. It lets
// the cron distinguish an emergency verdict from an ordinary milestone/verdict
// vote without a schema change. `posts.author_wallet` is plain TEXT (no FK).
export const EMERGENCY_SYSTEM_WALLET = '0x000000000000000000000000000000000000e911'

const VERDICT_VOTE_HOURS = 48

// Fast lane: the moment a call reaches its pool (becomes active), the project's
// Trust Score is provisionally lowered by this magnitude as a visible "under
// review" signal across the app. It is fully reversed at resolution, then the
// real verdict delta is applied — so the net effect equals the outcome alone.
export const PROVISIONAL_ALERT_TS = 15

/** Clamp-and-log a Trust Score change for a project (0–110). No-op on 0. */
export async function adjustTrust(projectId: string, delta: number, reason: string) {
  if (delta === 0) return
  const { data: proj } = await supabaseAdmin
    .from('projects').select('trust_score').eq('id', projectId).single()
  if (!proj) return
  const newScore = Math.max(0, Math.min(110, (proj.trust_score as number) + delta))
  await Promise.all([
    supabaseAdmin.from('projects').update({ trust_score: newScore }).eq('id', projectId),
    supabaseAdmin.from('trust_score_log').insert({ project_id: projectId, delta, score_after: newScore, reason }),
  ])
}

// Outcome economics — kept in sync with the manual resolve endpoint so the
// automatic and backstop paths behave identically.
//   resolved — real issue, community satisfied: half the staked ZXP returned, TS −10
//   ignored  — real issue, unresolved: stake returned +30% bonus, TS −20
//   neutral  — no quorum: full refund, no penalty (community simply didn't engage)
export const EMERGENCY_OUTCOMES = {
  resolved: { status: 'resolved', zxp_multiplier: 0.5, ts_delta: -10 },
  ignored:  { status: 'ignored',  zxp_multiplier: 1.3, ts_delta: -20 },
  neutral:  { status: 'expired',  zxp_multiplier: 1.0, ts_delta: 0   },
} as const

export type EmergencyCallRow = {
  id: string
  project_id: string
  reason: string
  pool_zxp: number
  participant_count: number
  created_at: string
}

/** True if the project posted a public response after the call was raised. */
export async function hasProjectResponded(call: {
  project_id: string
  created_at: string
}): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('posts')
    .select('id')
    .eq('project_id', call.project_id)
    .eq('post_type', 'verdict')
    .eq('title', EMERGENCY_RESPONSE_TITLE)
    .gte('created_at', call.created_at)
    .limit(1)
    .maybeSingle()
  return !!data
}

/** The open (not-yet-finalized) verdict vote for a project, if one exists. */
export async function getVerdictPost(projectId: string) {
  const { data } = await supabaseAdmin
    .from('posts')
    .select('id, voting_deadline, voting_finalized')
    .eq('project_id', projectId)
    .eq('author_wallet', EMERGENCY_SYSTEM_WALLET)
    .eq('post_type', 'voting')
    .eq('voting_finalized', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

/**
 * Ensure a community-verdict voting post exists for an active call whose
 * response window has elapsed. Idempotent — returns the existing post if the
 * call was already converted. `created` is true only on first conversion so
 * callers can fire a one-time notification.
 */
export async function ensureVerdictVote(
  call: EmergencyCallRow,
): Promise<{ post: { id: string; voting_deadline: string | null }; created: boolean }> {
  const existing = await getVerdictPost(call.project_id)
  if (existing) {
    return { post: { id: existing.id as string, voting_deadline: existing.voting_deadline as string | null }, created: false }
  }

  const responded = await hasProjectResponded(call)
  const { data: proj } = await supabaseAdmin
    .from('projects').select('name').eq('id', call.project_id).maybeSingle()
  const projName = (proj?.name as string) ?? 'this project'

  const content =
    `🚨 An Emergency Call against ${projName} reached its pool ` +
    `(${call.pool_zxp} ZXP from ${call.participant_count} wallets).\n\n` +
    `Reason: ${call.reason.slice(0, 600)}\n\n` +
    `The project ${responded ? 'posted a public response' : 'did NOT respond within 48h'}. ` +
    `The community now decides the verdict — vote:\n` +
    `• Resolved — the project adequately addressed this concern\n` +
    `• Unresolved — the problem is real and was left unaddressed`

  const { data: post } = await supabaseAdmin
    .from('posts')
    .insert({
      project_id:         call.project_id,
      author_wallet:      EMERGENCY_SYSTEM_WALLET,
      post_type:          'voting',
      title:              EMERGENCY_VERDICT_TITLE,
      content:            content.slice(0, 2000),
      trust_score_change: 0,
      voting_deadline:    new Date(Date.now() + VERDICT_VOTE_HOURS * 3_600_000).toISOString(),
      voting_delta:       0,
      voting_finalized:   false,
    })
    .select('id, voting_deadline')
    .single()

  return {
    post: { id: post!.id as string, voting_deadline: post!.voting_deadline as string | null },
    created: true,
  }
}
