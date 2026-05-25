import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { effectiveEmergencyConfig } from '@/lib/emergency-config'

// GET /api/emergency?project_id=UUID
export async function GET(req: NextRequest) {
  const project_id = req.nextUrl.searchParams.get('project_id')
  if (!project_id) return NextResponse.json({ call: null, config: effectiveEmergencyConfig(1) })

  const [{ data: call }, { data: epochCfg }] = await Promise.all([
    supabaseAdmin
      .from('emergency_calls')
      .select('id, status, reason, pool_zxp, participant_count, collecting_until, response_until, created_at, initiator_wallet')
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

  if (!call) return NextResponse.json({ call: null, config })

  // Auto-expire collecting calls whose 48h window passed without reaching pool
  if (call.status === 'collecting' && new Date(call.collecting_until) < new Date()) {
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

    return NextResponse.json({ call: null, config })
  }

  return NextResponse.json({ call, config })
}
