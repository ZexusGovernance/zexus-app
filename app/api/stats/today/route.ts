import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/i

export async function GET() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const iso       = todayStart.toISOString()
  const todayDate = iso.slice(0, 10) // 'YYYY-MM-DD' for daily_checkins

  const [postsRes, projectsRes, zxpRes, postsWalletsRes, checkinsRes, reactionsRes, commentsRes] = await Promise.all([
    supabaseAdmin.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', iso),
    supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('zxp_transactions').select('amount').gte('created_at', iso),
    // Wallets that posted today
    supabaseAdmin.from('posts').select('author_wallet').gte('created_at', iso),
    // Wallets that did daily check-in today
    supabaseAdmin.from('daily_checkins').select('wallet_address').eq('checkin_date', todayDate),
    // Wallets that liked/reacted today (filter out device UUIDs, keep only 0x... wallets)
    supabaseAdmin.from('post_reactions').select('wallet_address').gte('created_at', iso),
    // Wallets that commented today
    supabaseAdmin.from('post_comments').select('author_wallet').gte('created_at', iso),
  ])

  const posts_today    = postsRes.count ?? 0
  const projects_total = projectsRes.count ?? 0
  const zxp_today      = (zxpRes.data ?? []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

  // Union all wallet-connected activity today, ignore device UUIDs
  const wallets = new Set<string>([
    ...(postsWalletsRes.data  ?? []).map(r => r.author_wallet).filter(w => WALLET_RE.test(w)),
    ...(checkinsRes.data      ?? []).map(r => r.wallet_address).filter(w => WALLET_RE.test(w)),
    ...(reactionsRes.data     ?? []).map(r => r.wallet_address).filter(w => WALLET_RE.test(w)),
    ...(commentsRes.data      ?? []).map(r => r.author_wallet).filter(w => WALLET_RE.test(w)),
  ])
  const users_today = wallets.size

  return NextResponse.json({ posts_today, projects_total, zxp_today, users_today })
}
