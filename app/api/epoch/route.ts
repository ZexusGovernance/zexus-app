import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { effectiveEmergencyConfig } from '@/lib/emergency-config'

export async function GET() {
  const { data: cfg } = await supabaseAdmin
    .from('epoch_config')
    .select('*')
    .eq('id', 1)
    .single()

  if (!cfg) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const epochEnd  = new Date(cfg.epoch_end as string)
  const msLeft    = epochEnd.getTime() - Date.now()
  const daysLeft  = Math.max(0, Math.ceil(msLeft / 86_400_000))
  const median    = (cfg.median_balance as number) ?? 150
  const apyBps    = (cfg.current_apy_bps as number) ?? 800
  const { pool_goal } = effectiveEmergencyConfig((cfg.scale_factor as number) ?? 1)

  return NextResponse.json({
    epoch_number:        cfg.epoch_number,
    epoch_start:         cfg.epoch_start,
    epoch_end:           cfg.epoch_end,
    days_until_end:      daysLeft,
    apy_bps:             apyBps,
    apy_percent:         (apyBps / 100).toFixed(1),
    vote_burn_cost:      cfg.vote_burn_cost,
    voting_post_cost:    cfg.voting_post_cost,
    emergency_call_cost: pool_goal,
    median_balance:      median,
    staking_budget:      cfg.staking_budget,
  })
}
