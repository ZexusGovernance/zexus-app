import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/users/:wallet — public view of another user's profile.
// Honors the "Public profile" privacy toggle: if the owner turned it off,
// only name + avatar are returned and { public: false }.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet: raw } = await params
  const wallet = raw?.toLowerCase().trim()
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('wallet_address, display_name, avatar_url, zxp_balance, settings, registered_at')
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isPublic = (profile.settings as Record<string, boolean> | null)?.publicProfile !== false

  const base = {
    wallet,
    display_name: (profile.display_name as string) ?? null,
    avatar_url:   (profile.avatar_url as string) ?? null,
    public:       isPublic,
  }

  if (!isPublic) return NextResponse.json({ profile: base })

  // Rank by ZXP balance
  let rank = 1
  try {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gt('zxp_balance', (profile.zxp_balance as number) ?? 0)
    rank = (count ?? 0) + 1
  } catch { /* ignore */ }

  // Verdicts cast + accuracy (share of finalized votes that matched the outcome)
  const { data: votes } = await supabaseAdmin
    .from('voting_votes')
    .select('post_id, vote')
    .eq('wallet_address', wallet)

  const verdicts = votes?.length ?? 0
  let correct = 0
  let finalized = 0
  if (votes?.length) {
    const postIds = [...new Set(votes.map(v => v.post_id as string))]
    const { data: posts } = await supabaseAdmin
      .from('posts')
      .select('id, voting_finalized, trust_score_change')
      .in('id', postIds)
    const pmap = new Map((posts ?? []).map(p => [p.id as string, p]))
    for (const v of votes) {
      const p = pmap.get(v.post_id as string)
      if (!p || !p.voting_finalized) continue
      finalized++
      const passed = ((p.trust_score_change as number) ?? 0) > 0
      if ((v.vote === 'confirm' && passed) || (v.vote === 'dispute' && !passed)) correct++
    }
  }
  const accuracy = finalized > 0 ? Math.round((correct / finalized) * 100) : null

  return NextResponse.json({
    profile: {
      ...base,
      zxp_balance:   (profile.zxp_balance as number) ?? 0,
      rank,
      registered_at: (profile.registered_at as string) ?? null,
      verdicts,
      finalized,
      accuracy,
    },
  })
}
