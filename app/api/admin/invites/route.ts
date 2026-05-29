import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth'

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS ?? '').toLowerCase().split(',').filter(Boolean)

// Invite codes may be managed by any wallet in ADMIN_WALLETS — verified via
// the SIWE session, never from a client-supplied address.
function isInviteAdmin(wallet: string | null): boolean {
  return !!wallet && ADMIN_WALLETS.includes(wallet.toLowerCase())
}

export async function GET(req: NextRequest) {
  if (!isInviteAdmin(requireAuth(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ codes: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!isInviteAdmin(requireAuth(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { code, project_name, note } = await req.json() as {
    code?: string; project_name?: string; note?: string
  }
  if (!code?.trim()) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .insert({ code: code.trim().toUpperCase(), project_name: project_name || null, note: note || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ code: data })
}

export async function DELETE(req: NextRequest) {
  if (!isInviteAdmin(requireAuth(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { code } = await req.json() as { code?: string }
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  await supabaseAdmin.from('invite_codes').delete().eq('code', code)
  return NextResponse.json({ ok: true })
}
