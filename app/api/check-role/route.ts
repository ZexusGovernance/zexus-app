import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase().trim() ?? ''

  if (!WALLET_RE.test(wallet)) {
    return NextResponse.json({ role: 'user', project: null })
  }

  let { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, name, slug, description, category, avatar_url, website_url, whitepaper_url, github_url, twitter_url, discord_url, trust_score, is_verified, has_token, show_holders, show_votes')
    .eq('admin_wallet', wallet)
    .maybeSingle()

  // Fallback: new columns may not exist yet — retry with base columns only
  if (projectError) {
    console.warn('[check-role] full select failed, retrying without new columns:', projectError.message)
    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from('projects')
      .select('id, name, slug, description, category, avatar_url, website_url, trust_score, is_verified')
      .eq('admin_wallet', wallet)
      .maybeSingle()
    if (fallbackError) {
      console.error('[check-role] fallback query error:', fallbackError.message)
    }
    if (fallback) {
      project = { ...fallback, has_token: false, show_holders: true, show_votes: true, whitepaper_url: null, github_url: null, twitter_url: null, discord_url: null }
    }
  }

  // Register any connecting wallet as a profile (idempotent)
  await supabaseAdmin
    .from('profiles')
    .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true })

  return NextResponse.json({
    role: project ? 'project' : 'user',
    project: project ?? null,
  })
}
