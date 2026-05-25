import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface Milestone {
  id:          string
  project_id:  string
  year:        number
  quarter:     number
  title:       string
  description: string | null
  status:      'upcoming' | 'in_progress' | 'pending_confirmation' | 'completed' | 'disputed' | 'missed' | 'void'
  sort_order:  number
  deadline:    string | null  // YYYY-MM-DD
}

// GET /api/milestones?project_id=X
export async function GET(req: NextRequest) {
  const project_id = req.nextUrl.searchParams.get('project_id')
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .select('id, project_id, year, quarter, title, description, status, sort_order, deadline')
    .eq('project_id', project_id)
    .order('year').order('quarter').order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestones: data ?? [] })
}

// POST /api/milestones — add milestone (project admin only)
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { wallet, project_id, year, quarter, title, description, status, deadline } = body

  if (!wallet || !project_id || !year || !quarter || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: proj } = await supabaseAdmin
    .from('projects').select('id').eq('id', project_id)
    .eq('admin_wallet', (wallet as string).toLowerCase()).maybeSingle()

  if (!proj) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .insert({
        project_id,
        year,
        quarter,
        title,
        description: description ?? null,
        status:      status ?? 'upcoming',
        sort_order:  0,
        deadline:    typeof deadline === 'string' && deadline ? deadline : null,
      })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestone: data })
}

// DELETE /api/milestones?id=X&wallet=Y
export async function DELETE(req: NextRequest) {
  const id     = req.nextUrl.searchParams.get('id')
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase()
  if (!id || !wallet) return NextResponse.json({ error: 'id and wallet required' }, { status: 400 })

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
// When status = 'pending_confirmation': creates a voting post and awaits community vote
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { wallet, id, status } = body
  if (!wallet || !id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const walletLower = (wallet as string).toLowerCase()

  const { data: oldMs } = await supabaseAdmin
    .from('project_milestones')
    .select('project_id, status, year, quarter, title, description')
    .eq('id', id as string)
    .maybeSingle()
  if (!oldMs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: proj } = await supabaseAdmin
    .from('projects')
    .select('id, name, trust_score, voting_pts_earned')
    .eq('id', oldMs.project_id)
    .eq('admin_wallet', walletLower)
    .maybeSingle()
  if (!proj) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Submit for community confirmation ──────────────────────────────────────
  if (status === 'pending_confirmation') {
    if (oldMs.status === 'completed' || oldMs.status === 'pending_confirmation') {
      return NextResponse.json({ error: 'Already completed or pending' }, { status: 400 })
    }

    // Check quarter cap: only 1 completed/pending milestone counts per quarter
    const { count: alreadyDone } = await supabaseAdmin
      .from('project_milestones')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', oldMs.project_id)
      .eq('year', oldMs.year)
      .eq('quarter', oldMs.quarter)
      .in('status', ['completed', 'pending_confirmation'])
      .neq('id', id as string)

    if ((alreadyDone ?? 0) > 0) {
      return NextResponse.json(
        { error: `Only 1 milestone per quarter can earn points (Q${oldMs.quarter} ${oldMs.year} already has one)` },
        { status: 400 },
      )
    }

    // Update milestone status
    const { data: updated, error: msErr } = await supabaseAdmin
      .from('project_milestones')
      .update({ status: 'pending_confirmation' })
      .eq('id', id as string)
      .select().single()
    if (msErr) return NextResponse.json({ error: msErr.message }, { status: 500 })

    // Auto-create a voting post linked to this milestone
    const postTitle   = `Milestone: ${oldMs.title}`
    const postContent = oldMs.description
      ? `Community vote: did ${proj.name} complete this milestone?\n\n${oldMs.description}`
      : `Community vote: did ${proj.name} complete this Q${oldMs.quarter} ${oldMs.year} milestone — "${oldMs.title}"?`

    const { data: votingPost, error: postErr } = await supabaseAdmin
      .from('posts')
      .insert({
        project_id:       proj.id,
        author_wallet:    walletLower,
        post_type:        'voting',
        title:            postTitle,
        content:          postContent,
        trust_score_change: 0,
        voting_deadline:  new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        voting_delta:     3,   // fixed +3 pts for milestone
        milestone_id:     id,
      })
      .select('id')
      .single()

    if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 })

    return NextResponse.json({ milestone: updated, voting_post_id: votingPost.id })
  }

  // ── Direct status update (upcoming ↔ in_progress only) ────────────────────
  const allowedDirect = ['upcoming', 'in_progress']
  if (!allowedDirect.includes(status as string)) {
    return NextResponse.json({ error: 'Use pending_confirmation to submit for community review' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('project_milestones').update({ status }).eq('id', id as string).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ milestone: data })
}
