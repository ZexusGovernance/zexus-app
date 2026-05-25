import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/projects/[slug]/holders
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (!project) return NextResponse.json({ holders: [] })

  const { data } = await supabaseAdmin
    .from('token_holders')
    .select('wallet_address, verified_at, balance_raw')
    .eq('project_id', project.id)
    .order('verified_at', { ascending: false })

  return NextResponse.json({ holders: data ?? [] })
}
