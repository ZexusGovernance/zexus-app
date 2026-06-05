import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth'

// Admins = the super admin wallet plus any optional extras in ADMIN_WALLETS.
// Verified via the SIWE session, never from a client-supplied address.
const ADMIN_WALLETS = [
  process.env.SUPER_ADMIN_WALLET ?? '',
  ...(process.env.ADMIN_WALLETS ?? '').split(','),
]
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)

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

  const { code, project_name, note, expires_at } = await req.json() as {
    code?: string; project_name?: string; note?: string; expires_at?: string
  }
  if (!code?.trim()) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  // expires_at is optional. Accept an ISO/date string; blank means never expires.
  // A bare YYYY-MM-DD is treated as the end of that day (valid through that date).
  let expiresISO: string | null = null
  if (expires_at?.trim()) {
    const raw = /^\d{4}-\d{2}-\d{2}$/.test(expires_at.trim())
      ? `${expires_at.trim()}T23:59:59`
      : expires_at.trim()
    const d = new Date(raw)
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 })
    expiresISO = d.toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .insert({
      code: code.trim().toUpperCase(),
      project_name: project_name || null,
      note: note || null,
      expires_at: expiresISO,
    })
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
