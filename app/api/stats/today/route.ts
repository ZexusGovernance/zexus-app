import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const iso = todayStart.toISOString()

  const [postsRes, projectsRes, zxpRes, usersRes] = await Promise.all([
    // Posts today
    supabaseAdmin.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', iso),
    // Total projects
    supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }),
    // ZXP earned today
    supabaseAdmin.from('zxp_transactions').select('amount').gte('created_at', iso),
    // Active wallets today: unique authors from posts + reactions
    supabaseAdmin.from('posts').select('author_wallet').gte('created_at', iso),
  ])

  const posts_today = postsRes.count ?? 0
  const projects_total = projectsRes.count ?? 0

  const zxp_today = (zxpRes.data ?? []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

  // Unique wallets that posted today (simple proxy for active users)
  const wallets = new Set((usersRes.data ?? []).map(r => r.author_wallet))
  const users_today = wallets.size

  return NextResponse.json({ posts_today, projects_total, zxp_today, users_today })
}
