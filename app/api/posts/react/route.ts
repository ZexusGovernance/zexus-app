import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/
const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validIdentifier(s: string) {
  return WALLET_RE.test(s) || DEVICE_RE.test(s)
}

async function getCount(post_id: string) {
  const { count } = await supabaseAdmin
    .from('post_reactions')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post_id)
    .eq('reaction', 'like')
  return count ?? 0
}

// GET /api/posts/react?post_id=&identifier=
export async function GET(req: NextRequest) {
  const post_id    = req.nextUrl.searchParams.get('post_id') ?? ''
  const identifier = req.nextUrl.searchParams.get('identifier') ?? ''

  if (!post_id) return NextResponse.json({ liked: false, count: 0 })

  const count = await getCount(post_id)

  let liked = false
  if (identifier && validIdentifier(identifier)) {
    const { data } = await supabaseAdmin
      .from('post_reactions')
      .select('id')
      .eq('post_id', post_id)
      .eq('wallet_address', identifier)
      .eq('reaction', 'like')
      .maybeSingle()
    liked = !!data
  }

  return NextResponse.json({ liked, count })
}

// POST /api/posts/react  { post_id, identifier }  → add like
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const post_id    = String(body.post_id    ?? '')
  const identifier = String(body.identifier ?? '')

  if (!post_id || !identifier || !validIdentifier(identifier)) {
    return NextResponse.json({ error: 'post_id and valid identifier required' }, { status: 400 })
  }

  // Check if already liked — avoids duplicate without requiring UNIQUE constraint
  const { data: existing } = await supabaseAdmin
    .from('post_reactions')
    .select('id')
    .eq('post_id', post_id)
    .eq('wallet_address', identifier)
    .eq('reaction', 'like')
    .maybeSingle()

  if (!existing) {
    const { error } = await supabaseAdmin
      .from('post_reactions')
      .insert({ post_id, wallet_address: identifier, reaction: 'like' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: await getCount(post_id) })
}

// DELETE /api/posts/react  { post_id, identifier }  → remove like
export async function DELETE(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const post_id    = String(body.post_id    ?? '')
  const identifier = String(body.identifier ?? '')

  if (!post_id || !identifier) {
    return NextResponse.json({ error: 'post_id and identifier required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('post_reactions')
    .delete()
    .eq('post_id', post_id)
    .eq('wallet_address', identifier)
    .eq('reaction', 'like')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: await getCount(post_id) })
}
