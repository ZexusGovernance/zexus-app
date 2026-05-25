import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/zxp/pool — total ZXP staked across all active positions
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('staking_positions')
    .select('amount')
    .eq('status', 'active')

  if (error) return NextResponse.json({ total: 0 }, { status: 500 })

  const total = (data ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0)
  return NextResponse.json({ total })
}
