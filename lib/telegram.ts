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

export async function setWebhook(url: string) {
  const res  = await fetch(`${API}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url }),
  })
  return res.json()
}
