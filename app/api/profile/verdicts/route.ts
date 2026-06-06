import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// GET /api/profile/verdicts?wallet=0x...
// Live verdict history + stats computed from voting_votes (matches the public
// /api/users view). The legacy `verdict_history` table is a never-populated
// placeholder, so the own-profile page must compute from real votes too.
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''
  if (!WALLET_RE.test(wallet)) {
    return NextResponse.json({ verdicts: 0, finalized: 0, accuracy: null, history: [] })
  }

  const { data: votes } = await supabaseAdmin
    .from('voting_votes')
    .select('id, post_id, vote, created_at')
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })

  if (!votes?.length) {
    return NextResponse.json({ verdicts: 0, finalized: 0, accuracy: null, history: [] })
  }

  const postIds = [...new Set(votes.map(v => v.post_id as string))]
  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select('id, title, project_id, voting_finalized, trust_score_change')
    .in('id', postIds)

  const pmap = new Map((posts ?? []).map(p => [p.id as string, p]))

  // Project names in a separate query (no embed → no FK-relationship dependency)
  const projectIds = [...new Set((posts ?? []).map(p => p.project_id as string).filter(Boolean))]
  const nameMap = new Map<string, string>()
  if (projectIds.length) {
    const { data: projs } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .in('id', projectIds)
    for (const pr of projs ?? []) nameMap.set(pr.id as string, pr.name as string)
  }

  let finalized = 0
  let correct   = 0
  const history = votes.map(v => {
    const p        = pmap.get(v.post_id as string)
    const isFinal  = !!p?.voting_finalized
    const passed   = ((p?.trust_score_change as number) ?? 0) > 0
    const projName = p?.project_id ? nameMap.get(p.project_id as string) : null

    let was_correct: boolean | null = null
    if (isFinal) {
      finalized++
      was_correct = (v.vote === 'confirm' && passed) || (v.vote === 'dispute' && !passed)
      if (was_correct) correct++
    }

    return {
      id:           v.id as string,
      post_id:      v.post_id as string,
      post_title:   (p?.title as string) ?? null,
      post_project: projName ?? null,
      verdict:      v.vote === 'confirm' ? 'yes' : 'no',
      was_correct,
      zxp_earned:   0,
      created_at:   v.created_at as string,
    }
  })

  const accuracy = finalized > 0 ? Math.round((correct / finalized) * 100) : null

  return NextResponse.json({ verdicts: votes.length, finalized, accuracy, history })
}
