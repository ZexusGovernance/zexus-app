import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

// Outcomes:
//   false_alarm  — ZXP burned, initiator 14d cooldown baked in via resolved_at, project 60d cooldown
//   resolved     — Real problem, team responded: ZXP back -1 each, TS -10
//   ignored      — Real problem, team ignored: ZXP back +3 each, TS -20

const OUTCOME_CONFIG = {
  false_alarm: { zxp_multiplier: 0,   ts_delta: 0   },  // ZXP burned
  resolved:    { zxp_multiplier: 0.5, ts_delta: -10  },  // half back
  ignored:     { zxp_multiplier: 1.3, ts_delta: -20  },  // back + 30% bonus
} as const

type Outcome = keyof typeof OUTCOME_CONFIG

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret') ?? ''
  if (ADMIN_SECRET && secret !== ADMIN_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const call_id = body.call_id as string
  const outcome = body.outcome as string

  if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
  if (!outcome || !['false_alarm', 'resolved', 'ignored'].includes(outcome))
    return NextResponse.json({ error: 'outcome must be false_alarm | resolved | ignored' }, { status: 400 })

  // ── 1. Load call ─────────────────────────────────────────────────────────────
  const { data: call } = await supabaseAdmin
    .from('emergency_calls')
    .select('id, project_id, status, pool_zxp, participant_count')
    .eq('id', call_id)
    .maybeSingle()

  if (!call)
    return NextResponse.json({ error: 'Emergency Call not found' }, { status: 404 })
  if (!['active', 'collecting'].includes(call.status as string))
    return NextResponse.json({ error: 'Call is already resolved' }, { status: 409 })

  const cfg = OUTCOME_CONFIG[outcome as Outcome]

  // ── 2. Load participants ──────────────────────────────────────────────────────
  const { data: parts } = await supabaseAdmin
    .from('emergency_participants')
    .select('wallet_address, amount')
    .eq('call_id', call_id)

  // ── 3. Return ZXP to participants ─────────────────────────────────────────────
  if (parts?.length && cfg.zxp_multiplier > 0) {
    await Promise.all(parts.map(async p => {
      const returnAmount = Math.floor((p.amount as number) * cfg.zxp_multiplier)
      if (returnAmount <= 0) return
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('zxp_balance').eq('wallet_address', p.wallet_address).single()
      if (prof) {
        await supabaseAdmin.from('profiles')
          .update({ zxp_balance: (prof.zxp_balance as number) + returnAmount })
          .eq('wallet_address', p.wallet_address)
      }
    }))
  }

  // ── 4. Apply trust score delta ────────────────────────────────────────────────
  if (cfg.ts_delta !== 0) {
    const { data: proj } = await supabaseAdmin
      .from('projects').select('trust_score').eq('id', call.project_id).single()
    if (proj) {
      const newScore = Math.max(0, Math.min(110, (proj.trust_score as number) + cfg.ts_delta))
      await supabaseAdmin.from('projects')
        .update({ trust_score: newScore })
        .eq('id', call.project_id)
    }
  }

  // ── 5. Mark call resolved ─────────────────────────────────────────────────────
  await supabaseAdmin
    .from('emergency_calls')
    .update({ status: outcome, resolved_at: new Date().toISOString() })
    .eq('id', call_id)

  return NextResponse.json({
    ok: true,
    outcome,
    participants: parts?.length ?? 0,
    ts_delta: cfg.ts_delta,
    zxp_multiplier: cfg.zxp_multiplier,
  })
}
