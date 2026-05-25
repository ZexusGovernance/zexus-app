import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/
const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validIdentifier(s: string) {
  return WALLET_RE.test(s) || DEVICE_RE.test(s)
}

async function getCount(comment_id: string) {
  const { count } = await supabaseAdmin
    .from('comment_reactions')
    .select('*', { count: 'exact', head: true })
    .eq('comment_id', comment_id)
    .eq('reaction', 'like')
  return count ?? 0
}

// GET /api/comments/react?comment_id=&identifier=
export async function GET(req: NextRequest) {
  const comment_id = req.nextUrl.searchParams.get('comment_id') ?? ''
  const identifier = req.nextUrl.searchParams.get('identifier') ?? ''

  if (!comment_id) return NextResponse.json({ liked: false, count: 0 })

  const count = await getCount(comment_id)

  let liked = false
  if (identifier && validIdentifier(identifier)) {
    const { data } = await supabaseAdmin
      .from('comment_reactions')
      .select('id')
      .eq('comment_id', comment_id)
      .eq('wallet_address', identifier)
      .eq('reaction', 'like')
      .maybeSingle()
    liked = !!data
  }

  return NextResponse.json({ liked, count })
}

// POST /api/comments/react  { comment_id, identifier }  → add like
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const comment_id = String(body.comment_id ?? '')
  const identifier = String(body.identifier ?? '')

  if (!comment_id || !identifier || !validIdentifier(identifier)) {
    return NextResponse.json({ error: 'comment_id and valid identifier required' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('comment_reactions')
    .select('id')
    .eq('comment_id', comment_id)
    .eq('wallet_address', identifier)
    .eq('reaction', 'like')
    .maybeSingle()

  if (!existing) {
    const { error } = await supabaseAdmin
      .from('comment_reactions')
      .insert({ comment_id, wallet_address: identifier, reaction: 'like' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: await getCount(comment_id) })
}

// DELETE /api/comments/react  { comment_id, identifier }  → remove like
export async function DELETE(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const comment_id = String(body.comment_id ?? '')
  const identifier = String(body.identifier ?? '')

  if (!comment_id || !identifier) {
    return NextResponse.json({ error: 'comment_id and identifier required' }, { status: 400 })
  }

  await supabaseAdmin
    .from('comment_reactions')
    .delete()
    .eq('comment_id', comment_id)
    .eq('wallet_address', identifier)
    .eq('reaction', 'like')

  return NextResponse.json({ ok: true, count: await getCount(comment_id) })
}
