import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { grantOnboardingReward } from '@/lib/onboarding'
import { notifyCommentReply } from '@/lib/notify'
import { requireAuth, unauthorized, isSuperAdmin } from '@/lib/auth'

const DELETED_MARKER = '[deleted]'

export async function GET(req: NextRequest) {
  const post_id = req.nextUrl.searchParams.get('post_id')
  if (!post_id) return NextResponse.json({ error: 'post_id is required' }, { status: 400 })

  // Prefer selecting edited_at; fall back if the column hasn't been added yet.
  let res = await supabaseAdmin
    .from('post_comments')
    .select('id, parent_id, author_wallet, content, created_at, edited_at')
    .eq('post_id', post_id)
    .order('created_at', { ascending: true })
    .limit(200)

  if (res.error) {
    res = await supabaseAdmin
      .from('post_comments')
      .select('id, parent_id, author_wallet, content, created_at')
      .eq('post_id', post_id)
      .order('created_at', { ascending: true })
      .limit(200) as typeof res
  }

  const { data: comments, error } = res
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = comments ?? []
  if (list.length === 0) return NextResponse.json({ comments: [] })

  const wallets = [...new Set(list.map(c => c.author_wallet))]
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('wallet_address, avatar_url, display_name')
    .in('wallet_address', wallets)
  const avatarMap: Record<string, string | null> = {}
  const nameMap: Record<string, string | null> = {}
  for (const p of profiles ?? []) {
    avatarMap[p.wallet_address] = p.avatar_url
    nameMap[p.wallet_address] = p.display_name
  }

  return NextResponse.json({
    comments: list.map(c => ({
      ...c,
      avatar_url: avatarMap[c.author_wallet] ?? null,
      display_name: nameMap[c.author_wallet] ?? null,
    })),
  })
}

export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { post_id, content, parent_id } = body

  if (!post_id || !content?.trim()) {
    return NextResponse.json({ error: 'post_id and content are required' }, { status: 400 })
  }
  if (content.length > 500) {
    return NextResponse.json({ error: 'Comment exceeds 500 characters' }, { status: 400 })
  }

  // Replies are single-level: resolve the target to its root comment so a
  // reply-to-a-reply attaches to the same top-level thread rather than nesting.
  let rootParentId:  string | null = null
  let replyToAuthor: string | null = null
  if (parent_id) {
    const { data: parent } = await supabaseAdmin
      .from('post_comments')
      .select('id, post_id, parent_id, author_wallet')
      .eq('id', parent_id)
      .maybeSingle()
    if (!parent || parent.post_id !== post_id) {
      return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 })
    }
    rootParentId  = parent.parent_id ?? parent.id
    replyToAuthor = parent.author_wallet  // notify whoever was actually replied to
  }

  const { data: comment, error } = await supabaseAdmin
    .from('post_comments')
    .insert({ post_id, parent_id: rootParentId, author_wallet: wallet.toLowerCase(), content: content.trim() })
    .select('id, parent_id, author_wallet, content, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await grantOnboardingReward(wallet.toLowerCase(), 'comment')

  // Notify the author of the comment that was replied to (in-app + Telegram).
  if (replyToAuthor) {
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('project_id')
      .eq('id', post_id)
      .maybeSingle()
    await notifyCommentReply({
      recipientWallet: replyToAuthor,
      replierWallet:   wallet,
      postId:          post_id,
      projectId:       (post?.project_id as string | null) ?? null,
      replyText:       content.trim(),
    }).catch(() => { /* notifications are non-critical */ })
  }

  return NextResponse.json({ comment }, { status: 201 })
}

// PATCH /api/comments  { id, content }  — edit your own comment
export async function PATCH(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: Record<string, string>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, content } = body
  if (!id || !content?.trim())
    return NextResponse.json({ error: 'id and content are required' }, { status: 400 })
  if (content.length > 500)
    return NextResponse.json({ error: 'Comment exceeds 500 characters' }, { status: 400 })

  const { data: comment } = await supabaseAdmin
    .from('post_comments').select('id, author_wallet').eq('id', id).maybeSingle()
  if (!comment)
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  if ((comment.author_wallet as string)?.toLowerCase() !== wallet.toLowerCase() && !isSuperAdmin(wallet))
    return NextResponse.json({ error: 'You can only edit your own comment' }, { status: 403 })

  // Stamp edited_at when available; fall back to content-only if the column
  // hasn't been added yet (the UI still flags the edit optimistically).
  let res = await supabaseAdmin
    .from('post_comments')
    .update({ content: content.trim(), edited_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, parent_id, author_wallet, content, created_at, edited_at')
    .single()

  if (res.error) {
    res = await supabaseAdmin
      .from('post_comments')
      .update({ content: content.trim() })
      .eq('id', id)
      .select('id, parent_id, author_wallet, content, created_at')
      .single() as typeof res
  }

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  return NextResponse.json({ comment: res.data })
}

// DELETE /api/comments?id=UUID  — delete your own comment.
// If it has replies, soft-delete (keep the thread); otherwise remove the row.
export async function DELETE(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: comment } = await supabaseAdmin
    .from('post_comments').select('id, author_wallet').eq('id', id).maybeSingle()
  if (!comment)
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  if ((comment.author_wallet as string)?.toLowerCase() !== wallet.toLowerCase() && !isSuperAdmin(wallet))
    return NextResponse.json({ error: 'You can only delete your own comment' }, { status: 403 })

  const { count } = await supabaseAdmin
    .from('post_comments')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', id)

  if ((count ?? 0) > 0) {
    await supabaseAdmin.from('post_comments').update({ content: DELETED_MARKER }).eq('id', id)
    return NextResponse.json({ ok: true, soft: true })
  }

  await supabaseAdmin.from('post_comments').delete().eq('id', id)
  return NextResponse.json({ ok: true, soft: false })
}
