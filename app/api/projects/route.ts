import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/projects — list all projects (public)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id, name, slug, category, description, trust_score, is_verified, avatar_url, has_token, created_at')
    .order('trust_score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projects: data ?? [] })
}

// PATCH /api/projects — update the project profile that belongs to the calling wallet
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { wallet, name, description, category, website_url, whitepaper_url, github_url, twitter_url, discord_url, avatar_url, show_holders, show_votes, has_token } = body

  if (!wallet || typeof wallet !== 'string') {
    return NextResponse.json({ error: 'wallet is required' }, { status: 400 })
  }

  const walletLower = wallet.toLowerCase()

  // Verify caller owns a project
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, slug, has_token')
    .eq('admin_wallet', walletLower)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ error: 'Forbidden: wallet is not a project admin' }, { status: 403 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof name === 'string' && name.trim())             updates.name           = name.trim()
  if (typeof description === 'string')                     updates.description    = description.trim()
  if (typeof category === 'string' && category.trim())     updates.category       = category.trim()
  if (typeof website_url === 'string')                     updates.website_url    = website_url.trim()
  if (typeof whitepaper_url === 'string')                  updates.whitepaper_url = whitepaper_url.trim()
  if (typeof github_url === 'string')                      updates.github_url     = github_url.trim()
  if (typeof twitter_url === 'string')                     updates.twitter_url    = twitter_url.trim()
  if (typeof discord_url === 'string')                     updates.discord_url    = discord_url.trim()
  if (typeof avatar_url === 'string')                      updates.avatar_url     = avatar_url.trim()
  if (typeof show_votes === 'boolean')                  updates.show_votes  = show_votes
  if (typeof has_token === 'boolean')                   updates.has_token   = has_token

  // show_holders: admin can only disable if has_token is false
  // (after this update has_token may have changed, so check the incoming value)
  const effectiveHasToken = typeof has_token === 'boolean' ? has_token : (project.has_token ?? false)
  if (typeof show_holders === 'boolean') {
    // If project has a token, holders tab is always shown
    updates.show_holders = effectiveHasToken ? true : show_holders
  } else if (effectiveHasToken) {
    // Toggling on has_token forces show_holders = true
    updates.show_holders = true
  }

  const { data: updated, error } = await supabaseAdmin
    .from('projects')
    .update(updates)
    .eq('id', project.id)
    .select('id, slug, name, description, category, avatar_url, website_url, whitepaper_url, github_url, twitter_url, discord_url, trust_score, is_verified, has_token, show_holders, show_votes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ project: updated })
}
