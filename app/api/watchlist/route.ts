import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// GET /api/watchlist?wallet=0x...  OR  GET /api/watchlist?project_id=X (returns watcher count)
export async function GET(req: NextRequest) {
  const project_id = req.nextUrl.searchParams.get('project_id')
  if (project_id) {
    const { count, error } = await supabaseAdmin
      .from('user_watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id)
    if (error) return NextResponse.json({ count: 0 })
    return NextResponse.json({ count: count ?? 0 })
  }

  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  if (!WALLET_RE.test(wallet)) return NextResponse.json({ items: [] })

  const { data: wl } = await supabaseAdmin
    .from('user_watchlist')
    .select('project_id, added_at')
    .eq('wallet_address', wallet)
    .order('added_at', { ascending: false })

  if (!wl?.length) return NextResponse.json({ items: [] })

  const projectIds = wl.map(w => w.project_id)
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('id, slug, name, category, trust_score, is_verified, avatar_url')
    .in('id', projectIds)

  const projMap: Record<string, typeof projects extends (infer T)[] | null ? T : never> = {}
  for (const p of projects ?? []) projMap[p.id] = p

  const items = wl.map(w => ({ project_id: w.project_id, added_at: w.added_at, projects: projMap[w.project_id] ?? null }))

  return NextResponse.json({ items })
}

// POST /api/watchlist — add project to watchlist
export async function POST(req: NextRequest) {
  let body: Record<string, string>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wallet = body.wallet?.toLowerCase().trim()
  const project_id = body.project_id?.trim()

  if (!wallet || !WALLET_RE.test(wallet) || !project_id) {
    return NextResponse.json({ error: 'wallet and project_id required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('user_watchlist')
    .upsert({ wallet_address: wallet, project_id }, { onConflict: 'wallet_address,project_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/watchlist — remove project from watchlist
export async function DELETE(req: NextRequest) {
  let body: Record<string, string>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wallet = body.wallet?.toLowerCase().trim()
  const project_id = body.project_id?.trim()

  if (!wallet || !WALLET_RE.test(wallet) || !project_id) {
    return NextResponse.json({ error: 'wallet and project_id required' }, { status: 400 })
  }

  await supabaseAdmin
    .from('user_watchlist')
    .delete()
    .eq('wallet_address', wallet)
    .eq('project_id', project_id)

  return NextResponse.json({ ok: true })
}
