import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET() {
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabaseAdmin
    .from('posts_feed')
    .select('project_id, project_name, project_slug, project_category, project_avatar_url, likes_count')
    .gte('created_at', oneMonthAgo)
    .not('project_id', 'is', null)

  if (!posts?.length) return NextResponse.json({ projects: [] })

  const map: Record<string, { name: string; slug: string; category: string; avatar_url: string | null; likes: number }> = {}
  for (const p of posts) {
    const id = p.project_id as string
    if (!id) continue
    if (!map[id]) {
      map[id] = {
        name:       (p.project_name as string) ?? '',
        slug:       (p.project_slug as string) ?? '',
        category:   (p.project_category as string) ?? 'Protocol',
        avatar_url: (p.project_avatar_url as string | null) ?? null,
        likes:      0,
      }
    }
    map[id].likes += (p.likes_count as number) ?? 0
  }

  const projects = Object.values(map)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 5)

  return NextResponse.json({ projects })
}
