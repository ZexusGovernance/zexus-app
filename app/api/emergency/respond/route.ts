import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireAuth, unauthorized, isSuperAdmin } from '@/lib/auth'
import { notifyProjectEmergency } from '@/lib/notify'
import { EMERGENCY_RESPONSE_TITLE, ensureVerdictVote, type EmergencyCallRow } from '@/lib/emergency'

// POST /api/emergency/respond { project_id, content }
// The project team publicly answers an active Emergency Call. The response is
// a normal public post the community can read before the verdict vote opens.
export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const project_id = body.project_id as string
  const content    = (body.content as string)?.trim()

  if (!project_id)
    return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  if (!content || content.length < 10)
    return NextResponse.json({ error: 'Response must be at least 10 characters' }, { status: 400 })
  if (content.length > 2000)
    return NextResponse.json({ error: 'Response exceeds 2000 characters' }, { status: 400 })

  // ── Authorize: must be the project admin (or super admin) ──────────────────
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, name, admin_wallet')
    .eq('id', project_id)
    .maybeSingle()

  if (!project)
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if ((project.admin_wallet as string)?.toLowerCase() !== wallet && !isSuperAdmin(wallet))
    return NextResponse.json({ error: 'Only the project team can respond to an Emergency Call' }, { status: 403 })

  // ── There must be an active call to respond to ─────────────────────────────
  const { data: call } = await supabaseAdmin
    .from('emergency_calls')
    .select('id, project_id, reason, pool_zxp, participant_count, created_at')
    .eq('project_id', project_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!call)
    return NextResponse.json({ error: 'No active Emergency Call to respond to' }, { status: 409 })

  // ── Publish the response as a public post ──────────────────────────────────
  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .insert({
      project_id,
      author_wallet:      wallet,
      post_type:          'verdict',
      title:              EMERGENCY_RESPONSE_TITLE,
      content,
      trust_score_change: 0,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })

  // Early transition: a response closes the 48h window immediately and opens the
  // community verdict vote. A responsive team doesn't wait out the full window —
  // the 48h vote itself gives the community time to weigh the public response.
  await supabaseAdmin
    .from('emergency_calls')
    .update({ response_until: new Date().toISOString() })
    .eq('id', call.id)

  const { post: verdict } = await ensureVerdictVote(call as EmergencyCallRow)

  void notifyProjectEmergency({
    projectId: project_id,
    title:     `${project.name} responded — verdict vote open`,
    body:      `${content.slice(0, 160)}${content.length > 160 ? '…' : ''}`,
    postId:    verdict.id,
  })

  return NextResponse.json({ ok: true, post_id: post.id, verdict_post_id: verdict.id })
}
