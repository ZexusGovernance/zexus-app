import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendListingEmail } from '@/lib/email'

const ADMIN_WALLET = (process.env.SUPER_ADMIN_WALLET ?? '').toLowerCase()

function isAdmin(wallet: unknown): boolean {
  return typeof wallet === 'string' && wallet.toLowerCase() === ADMIN_WALLET && ADMIN_WALLET !== ''
}

// GET /api/admin?wallet=X  — list all projects
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet') ?? ''
  if (!isAdmin(wallet)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id, name, slug, category, description, admin_wallet, website_url, github_url, trust_score, is_verified, has_token, show_holders, show_votes, avatar_url, created_at, contract_address, contact_email, twitter_followers, discord_members, github_commits_30d, product_stage, has_whitepaper, has_audit, team_doxxed, has_investors, has_partnerships, has_cex_listing, has_foundation_grant, has_media_mentions, has_hackathon_win, has_top_integration, onchain_wallets, onchain_tvl, contract_age_months')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projects: data ?? [] })
}

// POST /api/admin  — create project
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!isAdmin(body.wallet)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, slug, category, description, admin_wallet, website_url, trust_score, is_verified, contact_email } = body

  if (!name || typeof name !== 'string' || !slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      name:          (name as string).trim(),
      slug:          (slug as string).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      category:      typeof category === 'string' ? category.trim() : null,
      description:   typeof description === 'string' ? description.trim() : null,
      admin_wallet:  typeof admin_wallet === 'string' ? admin_wallet.toLowerCase().trim() : null,
      website_url:   typeof website_url === 'string' ? website_url.trim() : null,
      trust_score:   typeof trust_score === 'number' ? trust_score : 0,
      is_verified:   is_verified === true,
      contact_email: typeof contact_email === 'string' && contact_email.trim() ? contact_email.trim() : null,
      show_holders:  true,
      show_votes:    true,
      has_token:     false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send welcome email if contact_email provided
  if (data && typeof contact_email === 'string' && contact_email.trim() && process.env.RESEND_API_KEY) {
    sendListingEmail({
      to:          contact_email.trim(),
      projectName: data.name,
      slug:        data.slug,
      trustScore:  data.trust_score,
      adminWallet: data.admin_wallet,
    }).catch(err => console.error('sendListingEmail failed:', err))
  }

  return NextResponse.json({ project: data })
}

// PATCH /api/admin  — update any field
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!isAdmin(body.wallet)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { wallet: _w, ...updates } = rest

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id as string)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data })
}

// DELETE /api/admin?id=X&wallet=Y
export async function DELETE(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet') ?? ''
  const id     = req.nextUrl.searchParams.get('id') ?? ''
  if (!isAdmin(wallet)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
