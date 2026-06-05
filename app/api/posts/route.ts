import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { requireAuth, unauthorized, isSuperAdmin } from '@/lib/auth'

const VALID_TYPES = ['update', 'verdict', 'alert', 'voting'] as const
type PostType = (typeof VALID_TYPES)[number]

const POST_TYPE_LABEL: Record<PostType, string> = {
  update:  'Update',
  verdict: 'Verdict',
  alert:   '⚠️ Alert',
  voting:  '🗳 Vote',
}

async function fanOutNotifications(
  projectId: string,
  projectName: string,
  postId: string,
  postType: PostType,
  title: string | undefined,
  content: string,
) {
  const { data: watchers } = await supabaseAdmin
    .from('user_watchlist')
    .select('wallet_address')
    .eq('project_id', projectId)

  if (!watchers?.length) return

  const allWallets = watchers.map(w => w.wallet_address)

  // verdict/voting posts honor the "New verdicts" preference;
  // updates & alerts honor "Watchlist alerts".
  const prefKey = postType === 'verdict' || postType === 'voting' ? 'notifVerdicts' : 'notifWatchlist'

  // Pull settings + telegram for these watchers in one query
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('wallet_address, telegram_chat_id, settings')
    .in('wallet_address', allWallets)
  const profMap = new Map((profiles ?? []).map(p => [p.wallet_address as string, p]))

  // A watcher is notified unless they explicitly turned this preference off
  const wallets = allWallets.filter(
    w => (profMap.get(w)?.settings as Record<string, boolean> | null)?.[prefKey] !== false,
  )
  if (!wallets.length) return

  const label   = POST_TYPE_LABEL[postType]
  const notifTitle = `${label} · ${projectName}`
  const notifBody  = title || content.slice(0, 80) + (content.length > 80 ? '…' : '')

  // Insert in-app notifications in one batch
  await supabaseAdmin.from('notifications').insert(
    wallets.map(wallet_address => ({
      wallet_address,
      type:       postType,
      title:      notifTitle,
      body:       notifBody,
      project_id: projectId,
      post_id:    postId,
    })),
  )

  // Send Telegram to opted-in watchers who connected it
  const tgChatIds = wallets
    .map(w => profMap.get(w)?.telegram_chat_id as number | null | undefined)
    .filter((id): id is number => id != null)

  if (!tgChatIds.length) return

  const tgText = `🔔 <b>${notifTitle}</b>\n${notifBody}\n\n<a href="https://app.zexus.xyz">Open Zexus</a>`
  await Promise.allSettled(
    tgChatIds.map(id => sendTelegramMessage(id, tgText)),
  )
}

const AUTO_TRUST_DELTA: Record<PostType, number> = {
  verdict: 0,   // trust score only changes after voting closes, not on post creation
  alert:   -10,
  update:  0,
  voting:  0,
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// short_id lives on the posts table, not the posts_feed view — merge it in.
// Degrades gracefully if the column doesn't exist yet (pre-migration).
async function attachShortIds<T extends { id: string }>(
  rows: T[],
): Promise<(T & { short_id?: string | null })[]> {
  if (!rows.length) return rows
  const { data } = await supabaseAdmin
    .from('posts')
    .select('id, short_id')
    .in('id', rows.map(r => r.id))
  const map = new Map((data ?? []).map(d => [d.id as string, d.short_id as string]))
  return rows.map(r => ({ ...r, short_id: map.get(r.id) ?? null }))
}

export async function GET(req: NextRequest) {
  const id           = req.nextUrl.searchParams.get('id')
  const limit        = Math.min(50, Number(req.nextUrl.searchParams.get('limit')) || 20)
  const offset       = Number(req.nextUrl.searchParams.get('offset')) || 0
  const project_slug = req.nextUrl.searchParams.get('project_slug')
  const since        = req.nextUrl.searchParams.get('created_at')

  // Single-post fetch for deep links — accepts a UUID or a short_id
  if (id) {
    let lookupId = id
    if (!UUID_RE.test(id)) {
      const { data: byShort } = await supabaseAdmin
        .from('posts').select('id').eq('short_id', id).maybeSingle()
      if (!byShort) return NextResponse.json({ posts: [] })
      lookupId = byShort.id as string
    }
    const { data, error } = await supabaseAdmin.from('posts_feed').select('*').eq('id', lookupId).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ posts: data ? await attachShortIds([data]) : [] })
  }

  let query = supabaseAdmin
    .from('posts_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (project_slug) query = query.eq('project_slug', project_slug)
  if (since) query = query.gt('created_at', since)

  const { data: posts, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: await attachShortIds(posts ?? []) })
}

export async function POST(req: NextRequest) {
  const walletLower = requireAuth(req)
  if (!walletLower) return unauthorized()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { post_type, title, content, image_url } = body

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if ((content as string).length > 2500) {
    return NextResponse.json({ error: 'content exceeds 2500 characters' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(post_type as PostType)) {
    return NextResponse.json({ error: 'post_type must be update, verdict, alert, or voting' }, { status: 400 })
  }

  // Verify the connecting wallet is registered as a project admin
  const { data: project, error: projErr } = await supabaseAdmin
    .from('projects')
    .select('id, name, trust_score')
    .eq('admin_wallet', walletLower)
    .maybeSingle()

  if (projErr || !project) {
    return NextResponse.json({ error: 'Forbidden: wallet is not a project admin' }, { status: 403 })
  }

  const tsc = AUTO_TRUST_DELTA[post_type as PostType] ?? 0

  const isVoting     = post_type === 'voting'
  const deltaForVote = isVoting ? 5 : 0  // fixed — project cannot choose

  // Cooldown: max 1 voting post per project per 7 days
  let votingPostCost   = 0
  let adminFreeBalance = 0
  if (isVoting) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [{ count }, { data: epoch }, { data: adminProfile }] = await Promise.all([
      supabaseAdmin
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('post_type', 'voting')
        .gte('created_at', sevenDaysAgo),
      supabaseAdmin.from('epoch_config').select('voting_post_cost').eq('id', 1).single(),
      supabaseAdmin.from('profiles').select('zxp_balance, zxp_burned').eq('wallet_address', walletLower).maybeSingle(),
    ])
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Voting cooldown: only 1 vote per 7 days per project' }, { status: 429 })
    }
    votingPostCost   = (epoch?.voting_post_cost as number) ?? 10
    adminFreeBalance = (adminProfile?.zxp_balance as number) ?? 0
    if (adminFreeBalance < votingPostCost) {
      return NextResponse.json({
        error: `Creating a voting post costs ${votingPostCost} ZXP. You have ${adminFreeBalance} free ZXP.`,
      }, { status: 402 })
    }
  }

  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .insert({
      project_id:         project.id,
      author_wallet:      walletLower,
      post_type:          post_type as PostType,
      title:              typeof title === 'string' && title.trim() ? title.trim() : null,
      content:            (content as string).trim(),
      image_url:          typeof image_url === 'string' && image_url ? image_url : null,
      trust_score_change: tsc,
      ...(isVoting ? {
        voting_deadline:  new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        voting_delta:     deltaForVote,
      } : {}),
    })
    .select('*, projects(id, name, slug, category, trust_score)')
    .single()

  if (error) {
    console.error('posts insert error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Apply trust score delta to the project
  if (tsc !== 0) {
    const newScore = Math.max(0, Math.min(110, project.trust_score + tsc))
    await supabaseAdmin
      .from('projects')
      .update({ trust_score: newScore })
      .eq('id', project.id)
  }

  // Deduct ZXP cost for voting posts (fire-and-forget — post already created)
  if (isVoting && votingPostCost > 0) {
    const newBalance = adminFreeBalance - votingPostCost
    void Promise.all([
      supabaseAdmin.from('profiles')
        .update({ zxp_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('wallet_address', walletLower),
      supabaseAdmin.from('zxp_transactions').insert({
        wallet_address: walletLower,
        type:           'burn',
        amount:         -votingPostCost,
        note:           'Created voting post',
        balance_after:  newBalance,
      }),
    ])
  }

  // Fan-out notifications to watchlist followers (fire-and-forget)
  void fanOutNotifications(project.id, project.name, post.id, post_type as PostType, title as string | undefined, content as string)

  return NextResponse.json({ post }, { status: 201 })
}

// DELETE /api/posts?id=UUID  — super-admin hard-delete (session-verified)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ''

  if (!isSuperAdmin(requireAuth(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
