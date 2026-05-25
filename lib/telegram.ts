import { supabaseAdmin } from './supabase-server'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const API   = `https://api.telegram.org/bot${TOKEN}`

export async function sendTelegramMessage(chatId: number | bigint, text: string) {
  if (!TOKEN) return
  try {
    await fetch(`${API}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: String(chatId), text, parse_mode: 'HTML' }),
    })
  } catch { /* silent — notifications are non-critical */ }
}

// Send to a single wallet if they have Telegram connected
export async function notifyWallet(wallet: string, text: string) {
  if (!TOKEN) return
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('telegram_chat_id')
      .eq('wallet_address', wallet.toLowerCase())
      .maybeSingle()
    if (data?.telegram_chat_id) {
      await sendTelegramMessage(data.telegram_chat_id as number, text)
    }
  } catch { /* silent */ }
}

// Fan out to all watchlist followers of a project who have Telegram connected
export async function notifyProjectWatchers(projectId: string, text: string) {
  if (!TOKEN) return
  try {
    const { data: watchers } = await supabaseAdmin
      .from('user_watchlist')
      .select('wallet_address')
      .eq('project_id', projectId)
    if (!watchers?.length) return
    const wallets = watchers.map((w: { wallet_address: string }) => w.wallet_address)
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('telegram_chat_id')
      .in('wallet_address', wallets)
      .not('telegram_chat_id', 'is', null)
    if (!profiles?.length) return
    await Promise.allSettled(
      profiles.map((p: { telegram_chat_id: number }) =>
        sendTelegramMessage(p.telegram_chat_id, text),
      ),
    )
  } catch { /* silent */ }
}

export async function setWebhook(url: string) {
  const res  = await fetch(`${API}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url }),
  })
  return res.json()
}
