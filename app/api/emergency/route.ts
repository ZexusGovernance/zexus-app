import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { effectiveEmergencyConfig } from '@/lib/emergency-config'
import {
  ensureVerdictVote,
  hasProjectResponded,
  type EmergencyCallRow,
} from '@/lib/emergency'
import { notifyProjectWatchers } from '@/lib/telegram'

type Phase = 'collecting' | 'responding' | 'voting' | null

interface VerdictTally {
  post_id: string
  voting_deadline: string | null
  confirmWeight: number
  disputeWeight: number
  confirmCount: number
  disputeCount: number
  total: number
}

async function tallyVerdict(postId: string, deadline: string | null): Promise<VerdictTally> {
  const { data: votes } = await supabaseAdmin
    .from('voting_votes')
    .select('vote, vote_weight')
    .eq('post_id', postId)
  const all = votes ?? []
  const confirm = all.filter(v => v.vote === 'confirm')
  const dispute = all.filter(v => v.vote === 'dispute')
  return {
    post_id:       postId,
    voting_deadline: deadline,
    confirmWeight: Math.round(confirm.reduce((s, v) => s + ((v.vote_weight as number) ?? 1), 0) * 100) / 100,
    disputeWeight: Math.round(dispute.reduce((s, v) => s + ((v.vote_weight as number) ?? 1), 0) * 100) / 100,
    confirmCount:  confirm.length,
    disputeCount:  dispute.length,
    total:         all.length,
  }
}

// GET /api/emergency?project_id=UUID
export async function GET(req: NextRequest) {
  const project_id = req.nextUrl.searchParams.get('project_id')
  if (!project_id)
    return NextResponse.json({ call: null, config: effectiveEmergencyConfig(1), phase: null, responded: false, verdict: null })

  const [{ data: call }, { data: epochCfg }] = await Promise.all([
    supabaseAdmin
      .from('emergency_calls')
      .select('id, project_id, status, reason, pool_zxp, participant_count, collecting_until, response_until, created_at, initiator_wallet')
      .eq('project_id', project_id)
      .in('status', ['collecting', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('epoch_config')
      .select('scale_factor')
      .eq('id', 1)
      .single(),
  ])

  const config = effectiveEmergencyConfig((epochCfg?.scale_factor as number) ?? 1)

  const empty = (extra: object = {}) =>
    NextResponse.json({ call: null, config, phase: null, responded: false, verdict: null, ...extra })

  if (!call) return empty()

  // Auto-expire collecting calls whose 48h window passed without reaching pool
  if (call.status === 'collecting' && new Date(call.collecting_until as string) < new Date()) {
    await supabaseAdmin
      .from('emergency_calls')
      .update({ status: 'expired' })
      .eq('id', call.id)

    // Return all ZXP to participants
    const { data: parts } = await supabaseAdmin
      .from('emergency_participants')
      .select('wallet_address, amount')
      .eq('call_id', call.id)

    if (parts?.length) {
      await Promise.all(parts.map(async p => {
        const { data: prof } = await supabaseAdmin
          .from('profiles').select('zxp_balance').eq('wallet_address', p.wallet_address).single()
        if (prof) {
          await supabaseAdmin.from('profiles')
            .update({ zxp_balance: (prof.zxp_balance as number) + (p.amount as number) })
            .eq('wallet_address', p.wallet_address)
        }
      }))
    }

    return empty()
  }

  if (call.status === 'collecting')
    return NextResponse.json({ call, config, phase: 'collecting' as Phase, responded: false, verdict: null })

  // status === 'active'
  const responded = await hasProjectResponded(call as { project_id: string; created_at: string })
  const windowClosed = call.response_until ? new Date(call.response_until as string) < new Date() : false

  if (!windowClosed)
    return NextResponse.json({ call, config, phase: 'responding' as Phase, responded, verdict: null })

  // Response window elapsed → open (or reuse) the community verdict vote
  const { post, created } = await ensureVerdictVote(call as unknown as EmergencyCallRow)
  if (created) {
    void notifyProjectWatchers(project_id,
      `⚖️ <b>Community verdict open</b>\n` +
      `An Emergency Call response window has closed. Stakers are now deciding the outcome.\n\n` +
      `<a href="https://app.zexus.xyz">Vote on Zexus</a>`,
    )
  }

  const verdict = await tallyVerdict(post.id, post.voting_deadline)
  return NextResponse.json({ call, config, phase: 'voting' as Phase, responded, verdict })
}
