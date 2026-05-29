import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireAuth, unauthorized } from '@/lib/auth'

const PRESET_AVATARS = new Set([
  '/avatars/av1.svg', '/avatars/av2.svg', '/avatars/av3.svg',
  '/avatars/av4.svg', '/avatars/av5.svg', '/avatars/av6.svg',
])

export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const avatar_url = body.avatar_url as string

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
