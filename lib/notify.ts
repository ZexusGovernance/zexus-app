import { supabaseAdmin } from './supabase-server'
import { sendTelegramMessage } from './telegram'

// Notify every user who hasn't opted out of "New projects" (in-app + Telegram).
// Fire-and-forget — callers should not await the result on the request path.
export async function notifyNewProject(projectId: string, name: string) {
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('wallet_address, telegram_chat_id, settings')
  if (!profiles?.length) return

  const recipients = profiles.filter(
    p => (p.settings as Record<string, boolean> | null)?.notifProjects !== false,
  )
  if (!recipients.length) return

  const title    = `New project · ${name}`
  const bodyText = `${name} just joined the Zexus registry. Take a look and add it to your watchlist.`

  await supabaseAdmin.from('notifications').insert(
    recipients.map(p => ({
      wallet_address: p.wallet_address,
      type:       'update',
      title,
      body:       bodyText,
      project_id: projectId,
      post_id:    null,
    })),
  )

  const tgIds = recipients
    .map(p => p.telegram_chat_id as number | null | undefined)
    .filter((id): id is number => id != null)
  if (!tgIds.length) return

  const tgText = `🆕 <b>${title}</b>\n${bodyText}\n\n<a href="https://app.zexus.xyz">Open Zexus</a>`
  await Promise.allSettled(tgIds.map(id => sendTelegramMessage(id, tgText)))
}
