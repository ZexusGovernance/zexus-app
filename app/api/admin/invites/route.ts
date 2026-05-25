import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS ?? '').toLowerCase().split(',').filter(Boolean)

function isAdmin(wallet: string) {
  return ADMIN_WALLETS.includes(wallet.toLowerCase())
}

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get('wallet') ?? ''
  if (!isAdmin(wallet)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ codes: data ?? [] })
}

export async function POST(req: Request) {
  const { wallet, code, project_name, note } = await req.json() as {
    wallet?: string; code?: string; project_name?: string; note?: string
  }
  if (!wallet || !isAdmin(wallet)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!code?.trim()) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .insert({ code: code.trim().toUpperCase(), project_name: project_name || null, note: note || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ code: data })
}

export async function DELETE(req: Request) {
  const { wallet, code } = await req.json() as { wallet?: string; code?: string }
  if (!wallet || !isAdmin(wallet)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  await supabaseAdmin.from('invite_codes').delete().eq('code', code)
  return NextResponse.json({ ok: true })
}
