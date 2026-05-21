import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  let update: Record<string, unknown>
  try { update = await req.json() } catch {
    return NextResponse.json({ ok: false })
  }

  const msg = update.message as Record<string, unknown> | undefined
  if (!msg) return NextResponse.json({ ok: true })

  const chatId = (msg.chat as Record<string, unknown>)?.id as number
  const text   = ((msg.text as string) ?? '').trim()

  if (text === '/start') {
    await sendTelegramMessage(chatId,
      '👋 <b>Добро пожаловать в Zexus Bot!</b>\n\n' +
      'Для получения уведомлений о проектах из вашего вотчлиста:\n\n' +
      '1. Откройте <b>app.zexus.xyz</b>\n' +
      '2. Перейдите в Profile → Settings\n' +
      '3. Нажмите <b>Connect Telegram</b>\n' +
      '4. Отправьте сюда полученный код командой:\n' +
      '<code>/connect КОД</code>',
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
      await sendTelegramMessage(chatId, '❌ Неверный код. Сгенерируйте новый на сайте.')
      return NextResponse.json({ ok: true })
    }

    if (new Date(profile.telegram_code_expires_at) < new Date()) {
      await sendTelegramMessage(chatId, '⏰ Код истёк. Сгенерируйте новый на сайте.')
      return NextResponse.json({ ok: true })
    }

    await supabaseAdmin
      .from('profiles')
      .update({ telegram_chat_id: chatId, telegram_code: null, telegram_code_expires_at: null })
      .eq('wallet_address', profile.wallet_address)

    await sendTelegramMessage(chatId,
      '✅ <b>Telegram подключён!</b>\n\n' +
      'Теперь вы будете получать уведомления о новых постах от проектов из вашего вотчлиста.',
    )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
