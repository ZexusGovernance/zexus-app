import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  let update: Record<string, unknown>
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ ok: false })
  }

  const msg = update.message as Record<string, unknown> | undefined
  if (!msg) return NextResponse.json({ ok: true })

  const chatId = (msg.chat as Record<string, unknown>)?.id as number
  const text = ((msg.text as string) ?? '').trim()

  if (text === '/start') {
    await sendTelegramMessage(
      chatId,
      'Welcome to Zexus Bot!\n\n' +
        'To receive notifications about projects from your watchlist:\n\n' +
        '1. Open app.zexus.xyz\n' +
        '2. Go to Profile -> Settings\n' +
        '3. Click Connect Telegram\n' +
        '4. Send your code here using the command:\n' +
        '/connect CODE',
    )
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith('/connect ')) {
    const code = text.slice(9).trim().toUpperCase()

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address, telegram_code, telegram_code_expires_at')
      .eq('telegram_code', code)
      .maybeSingle()

    if (!profile) {
      await sendTelegramMessage(chatId, 'Invalid code. Generate a new one on the website.')
      return NextResponse.json({ ok: true })
    }

    if (new Date(profile.telegram_code_expires_at) < new Date()) {
      await sendTelegramMessage(chatId, 'Code expired. Generate a new one on the website.')
      return NextResponse.json({ ok: true })
    }

    await supabaseAdmin
      .from('profiles')
      .update({ telegram_chat_id: chatId, telegram_code: null, telegram_code_expires_at: null })
      .eq('wallet_address', profile.wallet_address)

    await sendTelegramMessage(
      chatId,
      'Telegram connected!\n\n' +
        'You will now receive notifications about new posts from projects in your watchlist.',
    )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
