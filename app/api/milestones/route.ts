import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface Milestone {
  id:          string
  project_id:  string
  year:        number
  quarter:     number
  title:       string
  description: string | null
  status:      'completed' | 'in_progress' | 'upcoming'
  sort_order:  number
}

// GET /api/milestones?project_id=X
export async function GET(req: NextRequest) {
  const project_id = req.nextUrl.searchParams.get('project_id')
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .select('id, project_id, year, quarter, title, description, status, sort_order')
    .eq('project_id', project_id)
    .order('year').order('quarter').order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestones: data ?? [] })
}

// POST /api/milestones — add milestone (admin only)
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { wallet, project_id, year, quarter, title, description, status } = body

  if (!wallet || !project_id || !year || !quarter || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify caller is admin of this project
  const { data: proj } = await supabaseAdmin
    .from('projects').select('id').eq('id', project_id)
    .eq('admin_wallet', (wallet as string).toLowerCase()).maybeSingle()

  if (!proj) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .insert({ project_id, year, quarter, title, description: description ?? null, status: status ?? 'upcoming', sort_order: 0 })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestone: data })
}

// DELETE /api/milestones?id=X&wallet=Y
export async function DELETE(req: NextRequest) {
  const id     = req.nextUrl.searchParams.get('id')
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase()
  if (!id || !wallet) return NextResponse.json({ error: 'id and wallet required' }, { status: 400 })

  // Verify admin
  const { data: ms } = await supabaseAdmin
    .from('project_milestones').select('project_id').eq('id', id).maybeSingle()
  if (!ms) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: proj } = await supabaseAdmin
    .from('projects').select('id').eq('id', ms.project_id).eq('admin_wallet', wallet).maybeSingle()
  if (!proj) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin.from('project_milestones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/milestones — update status
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { wallet, id, status } = body
  if (!wallet || !id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: ms } = await supabaseAdmin
    .from('project_milestones').select('project_id').eq('id', id as string).maybeSingle()
  if (!ms) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: proj } = await supabaseAdmin
    .from('projects').select('id').eq('id', ms.project_id)
    .eq('admin_wallet', (wallet as string).toLowerCase()).maybeSingle()
  if (!proj) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('project_milestones').update({ status }).eq('id', id as string).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestone: data })
}
