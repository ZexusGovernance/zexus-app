import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireAuth, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const walletLower = requireAuth(req)
  if (!walletLower) return unauthorized()

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { post_id, reaction } = body

  if (!post_id || !['like', 'dislike'].includes(reaction)) {
    return NextResponse.json({ error: 'post_id and reaction (like|dislike) are required' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('post_reactions')
    .select('id, reaction')
    .eq('post_id', post_id)
    .eq('wallet_address', walletLower)
    .maybeSingle()

  if (existing) {
    if (existing.reaction === reaction) {
      // Same reaction — toggle off
      await supabaseAdmin.from('post_reactions').delete().eq('id', existing.id)
      return NextResponse.json({ action: 'removed', reaction })
    }
    // Different reaction — switch
    await supabaseAdmin.from('post_reactions').update({ reaction }).eq('id', existing.id)
    return NextResponse.json({ action: 'updated', reaction })
  }

  await supabaseAdmin
    .from('post_reactions')
    .insert({ post_id, wallet_address: walletLower, reaction })

  return NextResponse.json({ action: 'added', reaction })
}
