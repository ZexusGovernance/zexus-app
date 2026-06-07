import { supabaseAdmin } from './supabase-server'
import { sendTelegramMessage } from './telegram'

export type ProjectPostType = 'update' | 'verdict' | 'alert' | 'voting'

const POST_TYPE_LABEL: Record<ProjectPostType, string> = {
  update:  'Update',
  verdict: 'Verdict',
  alert:   '⚠️ Alert',
  voting:  '🗳 Vote',
}

// Fan out in-app + Telegram notifications to a project's watchlist followers for
// a newly created project post. Honors each watcher's notification prefs:
//   verdict/voting → "New verdicts"     (notifVerdicts)
//   update/alert   → "Watchlist alerts" (notifWatchlist)
// Used by /api/posts and the milestone auto-vote in /api/milestones so both
// paths notify identically. Fire-and-forget on the request path.
export async function notifyProjectPost(opts: {
  projectId: string
  projectName: string
  postId: string
  postType: ProjectPostType
  title?: string | null
  content: string
}) {
  const { projectId, projectName, postId, postType, title, content } = opts

  const { data: watchers } = await supabaseAdmin
    .from('user_watchlist')
    .select('wallet_address')
    .eq('project_id', projectId)
  if (!watchers?.length) return

  const allWallets = watchers.map(w => w.wallet_address as string)
  const prefKey = postType === 'verdict' || postType === 'voting' ? 'notifVerdicts' : 'notifWatchlist'

  // Pull settings + telegram for these watchers in one query
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('wallet_address, telegram_chat_id, settings')
    .in('wallet_address', allWallets)
  const profMap = new Map((profiles ?? []).map(p => [p.wallet_address as string, p]))

  // A watcher is notified unless they explicitly turned this preference off
  const wallets = allWallets.filter(
    w => (profMap.get(w)?.settings as Record<string, boolean> | null)?.[prefKey] !== false,
  )
  if (!wallets.length) return

  const label      = POST_TYPE_LABEL[postType]
  const notifTitle = `${label} · ${projectName}`
  const notifBody  = title || content.slice(0, 80) + (content.length > 80 ? '…' : '')

  // Insert in-app notifications in one batch
  await supabaseAdmin.from('notifications').insert(
    wallets.map(wallet_address => ({
      wallet_address,
      type:       postType,
      title:      notifTitle,
      body:       notifBody,
      project_id: projectId,
      post_id:    postId,
    })),
  )

  // Send Telegram to opted-in watchers who connected it
  const tgChatIds = wallets
    .map(w => profMap.get(w)?.telegram_chat_id as number | null | undefined)
    .filter((id): id is number => id != null)
  if (!tgChatIds.length) return

  const tgText = `🔔 <b>${notifTitle}</b>\n${notifBody}\n\n<a href="https://app.zexus.xyz">Open Zexus</a>`
  await Promise.allSettled(tgChatIds.map(id => sendTelegramMessage(id, tgText)))
}

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
