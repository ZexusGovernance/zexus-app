import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// GET /api/notifications?wallet=0x...&limit=20&unread_only=true
export async function GET(req: NextRequest) {
  const wallet     = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  const limit      = Math.min(50, Number(req.nextUrl.searchParams.get('limit')) || 20)
  const unreadOnly = req.nextUrl.searchParams.get('unread_only') === 'true'

  if (!WALLET_RE.test(wallet)) return NextResponse.json({ notifications: [], unread_count: 0 })

  let query = supabaseAdmin
    .from('notifications')
    .select('id, type, title, body, project_id, post_id, is_read, created_at, projects(name, avatar_url, slug)')
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
    .eq('is_read', false)

  return NextResponse.json({ notifications: data ?? [], unread_count: count ?? 0 })
}

// PATCH /api/notifications — mark read
// body: { wallet, id? } — omit id to mark all read
export async function PATCH(req: NextRequest) {
  let body: Record<string, string>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wallet = body.wallet?.toLowerCase().trim()
  if (!wallet || !WALLET_RE.test(wallet))
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })

  let query = supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('wallet_address', wallet)

  if (body.id) query = query.eq('id', body.id)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
