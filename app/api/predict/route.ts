import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const ADMIN_WALLET = (process.env.SUPER_ADMIN_WALLET ?? '').toLowerCase()
function isAdmin(w: unknown) {
  return typeof w === 'string' && w.toLowerCase() === ADMIN_WALLET && ADMIN_WALLET !== ''
}

// GET /api/predict?status=open|resolved&wallet=0x...
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status')
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase()

  let query = supabaseAdmin
    .from('predict_markets')
    .select('*')
    .order('closes_at', { ascending: true })

  if (status) query = query.eq('status', status)

  const { data: markets, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Participant counts
  const ids = (markets ?? []).map(m => m.id as string)
  const { data: betRows } = ids.length
    ? await supabaseAdmin
        .from('predict_bets')
        .select('market_id')
        .in('market_id', ids)
    : { data: [] }

  const countMap = new Map<string, number>()
  for (const b of betRows ?? []) {
    const mid = b.market_id as string
    countMap.set(mid, (countMap.get(mid) ?? 0) + 1)
  }

  // User bets (option, amount, payout)
  let userBetMap: Record<string, { option: string; amount: number; payout: number | null }> = {}
  if (wallet && ids.length) {
    const { data: myBets } = await supabaseAdmin
      .from('predict_bets')
      .select('market_id, option, amount, payout')
      .eq('wallet_address', wallet)
      .in('market_id', ids)
    for (const b of myBets ?? []) {
      userBetMap[b.market_id as string] = {
        option: b.option as string,
        amount: b.amount as number,
        payout: b.payout as number | null,
      }
    }
  }

  const result = (markets ?? []).map(m => ({
    ...m,
    participants: countMap.get(m.id as string) ?? 0,
    user_bet: userBetMap[m.id as string] ?? null,
  }))

  return NextResponse.json({ markets: result })
}

// POST /api/predict — create market (admin only)
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isAdmin(body.wallet)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, description, category, option_a, option_b, closes_at, project_name } = body
  if (!title || typeof title !== 'string' || title.trim().length < 5) {
    return NextResponse.json({ error: 'title required (min 5 chars)' }, { status: 400 })
  }
  if (!closes_at) return NextResponse.json({ error: 'closes_at required' }, { status: 400 })
  if (new Date(closes_at as string) <= new Date()) {
    return NextResponse.json({ error: 'closes_at must be in the future' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('predict_markets').insert({
    title:        title.trim(),
    description:  description ? String(description).trim() : null,
    category:     category    ? String(category).trim()    : 'Platform',
    option_a:     option_a    ? String(option_a).trim()    : 'Yes',
    option_b:     option_b    ? String(option_b).trim()    : 'No',
    closes_at,
    project_name: project_name ? String(project_name).trim() : null,
    created_by:   (body.wallet as string).toLowerCase(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, market: data })
}
