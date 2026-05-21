import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

const VALID_TYPES = ['update', 'verdict', 'alert'] as const
type PostType = (typeof VALID_TYPES)[number]

const POST_TYPE_LABEL: Record<PostType, string> = {
  update:  'Update',
  verdict: 'Verdict',
  alert:   '⚠️ Alert',
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

  const wallets = watchers.map(w => w.wallet_address)
  const label   = POST_TYPE_LABEL[postType]
  const notifTitle = `${label} · ${projectName}`
  const notifBody  = title || content.slice(0, 80) + (content.length > 80 ? '…' : '')

  // Insert notifications in one batch
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

  // Send Telegram to those who connected it
  const { data: tgProfiles } = await supabaseAdmin
    .from('profiles')
    .select('telegram_chat_id')
    .in('wallet_address', wallets)
    .not('telegram_chat_id', 'is', null)

  if (!tgProfiles?.length) return

  const tgText = `🔔 <b>${notifTitle}</b>\n${notifBody}\n\n<a href="https://app.zexus.xyz">Open Zexus</a>`
  await Promise.allSettled(
    tgProfiles.map(p => sendTelegramMessage(p.telegram_chat_id, tgText)),
  )
}

const AUTO_TRUST_DELTA: Record<PostType, number> = {
  verdict: +8,
  alert:   -10,
  update:  0,
}

export async function GET(req: NextRequest) {
  const id           = req.nextUrl.searchParams.get('id')
  const limit        = Math.min(50, Number(req.nextUrl.searchParams.get('limit')) || 20)
  const offset       = Number(req.nextUrl.searchParams.get('offset')) || 0
  const project_slug = req.nextUrl.searchParams.get('project_slug')
  const since        = req.nextUrl.searchParams.get('created_at')

  // Single-post fetch for deep links
  if (id) {
    const { data, error } = await supabaseAdmin.from('posts_feed').select('*').eq('id', id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ posts: data ? [data] : [] })
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

  return NextResponse.json({ posts: posts ?? [] })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { wallet, post_type, title, content, image_url } = body

  if (!wallet || typeof wallet !== 'string') {
    return NextResponse.json({ error: 'wallet is required' }, { status: 400 })
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if ((content as string).length > 2500) {
    return NextResponse.json({ error: 'content exceeds 2500 characters' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(post_type as PostType)) {
    return NextResponse.json({ error: 'post_type must be update, verdict, or alert' }, { status: 400 })
  }

  const walletLower = wallet.toLowerCase()

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

  // Fan-out notifications to watchlist followers (fire-and-forget)
  void fanOutNotifications(project.id, project.name, post.id, post_type as PostType, title as string | undefined, content as string)

  return NextResponse.json({ post }, { status: 201 })
}
