import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/
const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validKey(s: string) {
  return WALLET_RE.test(s) || DEVICE_RE.test(s)
}

// POST /api/posts/view  { post_id, viewer_key }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const post_id    = String(body.post_id    ?? '')
  const viewer_key = String(body.viewer_key ?? '')

  if (!post_id || !viewer_key || !validKey(viewer_key)) {
    return NextResponse.json({ error: 'post_id and valid viewer_key required' }, { status: 400 })
  }

  // Check if already viewed — prevents double counting
  const { data: existing } = await supabaseAdmin
    .from('post_views')
    .select('post_id')
    .eq('post_id', post_id)
    .eq('viewer_key', viewer_key)
    .maybeSingle()

  if (existing) return NextResponse.json({ counted: false })

  // Insert view record
  const { error: insertErr } = await supabaseAdmin
    .from('post_views')
    .insert({ post_id, viewer_key })

  if (insertErr) {
    if (insertErr.code === '23505') return NextResponse.json({ counted: false })
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Atomic increment via DB function
  await supabaseAdmin.rpc('increment_post_views', { pid: post_id })

  return NextResponse.json({ counted: true })
}
