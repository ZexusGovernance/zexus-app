import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const { code } = (await req.json()) as { code?: string }
  if (!code) return NextResponse.json({ valid: false }, { status: 400 })

  const normalized = code.trim().toUpperCase()

  const { data } = await supabaseAdmin
    .from('invite_codes')
    .select('code, project_name, expires_at')
    .eq('code', normalized)
    .maybeSingle()

  if (!data) return NextResponse.json({ valid: false })

  // reject expired codes
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ valid: false, expired: true })
  }

  // mark first use
  await supabaseAdmin
    .from('invite_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', normalized)
    .is('used_at', null)

  return NextResponse.json({ valid: true, project: data.project_name })
}
