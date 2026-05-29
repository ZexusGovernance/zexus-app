import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireAuth, unauthorized } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  // Verify requester is the project admin
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, admin_wallet, trust_score')
    .eq('slug', slug)
    .maybeSingle()

  if (!project)
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if ((project.admin_wallet as string)?.toLowerCase() !== wallet)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const projectId = project.id as string
  const ago7d  = new Date(Date.now() - 7  * 86_400_000).toISOString()
  const ago30d = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [
    { count: watchlistTotal },
    { count: watchlist7d },
    { count: watchlist30d },
    { data: posts },
    { data: votes },
    { data: trustEvents },
  ] = await Promise.all([
    supabaseAdmin
      .from('user_watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabaseAdmin
      .from('user_watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .gte('added_at', ago7d),
    supabaseAdmin
      .from('user_watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .gte('added_at', ago30d),
    supabaseAdmin
      .from('posts')
      .select('id, title, post_type, views_count, created_at')
      .eq('project_id', projectId)
      .order('views_count', { ascending: false }),
    supabaseAdmin
      .from('voting_votes')
      .select('vote, post_id')
      .in(
        'post_id',
        // subquery workaround: fetch post IDs first then filter
        (await supabaseAdmin
          .from('posts')
          .select('id')
          .eq('project_id', projectId)
        ).data?.map(p => p.id) ?? [],
      ),
    supabaseAdmin
      .from('project_trust_events')
      .select('delta, score_after, created_at')
      .eq('project_id', projectId)
      .gte('created_at', ago30d)
      .order('created_at', { ascending: true }),
  ])

  const postArr  = posts ?? []
  const voteArr  = votes ?? []

  const viewsTotal = postArr.reduce((s, p) => s + ((p.views_count as number) ?? 0), 0)
  const views7d    = postArr
    .filter(p => p.created_at >= ago7d)
    .reduce((s, p) => s + ((p.views_count as number) ?? 0), 0)

  const votesConfirm = voteArr.filter(v => v.vote === 'confirm').length
  const votesDispute = voteArr.filter(v => v.vote === 'dispute').length

  // Trust score delta vs 30d ago
  const trustDelta30d = (trustEvents ?? []).reduce((s, e) => s + ((e.delta as number) ?? 0), 0)

  const topPosts = postArr.slice(0, 5).map(p => ({
    id:         p.id,
    title:      p.title ?? '(untitled)',
    type:       p.post_type,
    views:      (p.views_count as number) ?? 0,
    votes:      voteArr.filter(v => v.post_id === p.id).length,
    created_at: p.created_at,
  }))

  return NextResponse.json({
    watchlist_total:  watchlistTotal ?? 0,
    watchlist_7d:     watchlist7d    ?? 0,
    watchlist_30d:    watchlist30d   ?? 0,
    views_total:      viewsTotal,
    views_7d:         views7d,
    posts_count:      postArr.length,
    votes_confirm:    votesConfirm,
    votes_dispute:    votesDispute,
    trust_score:      project.trust_score as number,
    trust_delta_30d:  trustDelta30d,
    top_posts:        topPosts,
  })
}
