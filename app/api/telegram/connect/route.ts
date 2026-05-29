import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireAuth, unauthorized } from '@/lib/auth'

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// POST /api/telegram/connect
// body: { wallet } — generates a 6-char code valid 10 minutes
export async function POST(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  const code    = randomCode()
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      { wallet_address: wallet, telegram_code: code, telegram_code_expires_at: expires },
      { onConflict: 'wallet_address' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ code })
}

// DELETE /api/telegram/connect — disconnect telegram
export async function DELETE(req: NextRequest) {
  const wallet = requireAuth(req)
  if (!wallet) return unauthorized()

  await supabaseAdmin
    .from('profiles')
    .update({ telegram_chat_id: null, telegram_code: null, telegram_code_expires_at: null })
    .eq('wallet_address', wallet)

  return NextResponse.json({ ok: true })
}
