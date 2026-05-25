import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { grantOnboardingReward } from '@/lib/onboarding'

export async function GET(req: NextRequest) {
  const post_id = req.nextUrl.searchParams.get('post_id')
  if (!post_id) return NextResponse.json({ error: 'post_id is required' }, { status: 400 })

  const { data: comments, error } = await supabaseAdmin
    .from('post_comments')
    .select('id, author_wallet, content, created_at')
    .eq('post_id', post_id)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = comments ?? []
  if (list.length === 0) return NextResponse.json({ comments: [] })

  const wallets = [...new Set(list.map(c => c.author_wallet))]
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('wallet_address, avatar_url')
    .in('wallet_address', wallets)
  const avatarMap: Record<string, string | null> = {}
  for (const p of profiles ?? []) avatarMap[p.wallet_address] = p.avatar_url

  return NextResponse.json({
    comments: list.map(c => ({ ...c, avatar_url: avatarMap[c.author_wallet] ?? null })),
  })
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { wallet, post_id, content } = body

  if (!wallet || !post_id || !content?.trim()) {
    return NextResponse.json({ error: 'wallet, post_id and content are required' }, { status: 400 })
  }
  if (content.length > 500) {
    return NextResponse.json({ error: 'Comment exceeds 500 characters' }, { status: 400 })
  }

  const { data: comment, error } = await supabaseAdmin
    .from('post_comments')
    .insert({ post_id, author_wallet: wallet.toLowerCase(), content: content.trim() })
    .select('id, author_wallet, content, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await grantOnboardingReward(wallet.toLowerCase(), 'comment')

  return NextResponse.json({ comment }, { status: 201 })
}
