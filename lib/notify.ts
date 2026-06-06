import { supabaseAdmin } from './supabase-server'
import { sendTelegramMessage } from './telegram'

// Notify the author of a comment that someone replied to it (in-app + Telegram).
// Gated by the recipient's `notifReplies` setting (default ON). No-op for
// self-replies. Safe to await on the request path — it's a couple of quick reads.
export async function notifyCommentReply(opts: {
  recipientWallet: string
  replierWallet:   string
  postId:          string
  projectId:       string | null
  replyText:       string
}) {
  const recipient = opts.recipientWallet.toLowerCase()
  const replier   = opts.replierWallet.toLowerCase()
  if (recipient === replier) return

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('telegram_chat_id, settings')
    .eq('wallet_address', recipient)
    .maybeSingle()

  // Default ON — only skip if the recipient explicitly turned replies off.
  if ((profile?.settings as Record<string, boolean> | null)?.notifReplies === false) return

  const who     = `${replier.slice(0, 6)}…${replier.slice(-4)}`
  const snippet = opts.replyText.length > 120 ? `${opts.replyText.slice(0, 120)}…` : opts.replyText
  const title   = 'New reply to your comment'
  const bodyTxt = `${who} replied: “${snippet}”`

  await supabaseAdmin.from('notifications').insert({
    wallet_address: recipient,
    type:       'reply',
    title,
    body:       bodyTxt,
    project_id: opts.projectId,
    post_id:    opts.postId,
  })

  const chatId = profile?.telegram_chat_id as number | null | undefined
  if (chatId != null) {
    const tgText =
      `💬 <b>${title}</b>\n${bodyTxt}\n\n` +
      `<a href="https://app.zexus.xyz/post/${opts.postId}">View thread</a>`
    await sendTelegramMessage(chatId, tgText)
  }
}

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
