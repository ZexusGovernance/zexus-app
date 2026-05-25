import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/
const PRESET_AVATARS = new Set([
  '/avatars/av1.svg', '/avatars/av2.svg', '/avatars/av3.svg',
  '/avatars/av4.svg', '/avatars/av5.svg', '/avatars/av6.svg',
])

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wallet     = (body.wallet as string)?.toLowerCase().trim()
  const avatar_url = body.avatar_url as string

  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
  }
  if (!PRESET_AVATARS.has(avatar_url)) {
    return NextResponse.json({ error: 'Invalid avatar' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url })
    .eq('wallet_address', wallet)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, avatar_url })
}
