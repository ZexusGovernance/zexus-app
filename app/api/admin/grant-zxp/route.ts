// TEMPORARY admin endpoint — delete after use
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'zexus-dev-only'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const wallet = (body.wallet as string)?.toLowerCase().trim()
  const amount = Number(body.amount)

  if (!wallet || !amount) {
    return NextResponse.json({ error: 'wallet and amount required' }, { status: 400 })
  }

  // Upsert profile first
  await supabaseAdmin
    .from('profiles')
    .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true })

  // Get current balance (may not have zxp_balance column yet)
  const { data: profile, error: selErr } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance')
    .eq('wallet_address', wallet)
    .single()

  if (selErr) {
    // Columns don't exist yet — run supabase-zxp-schema.sql first
    return NextResponse.json({ error: 'Run supabase-zxp-schema.sql migration first: ' + selErr.message }, { status: 500 })
  }

  const newBalance = (profile?.zxp_balance ?? 0) + amount

  await supabaseAdmin
    .from('profiles')
    .update({ zxp_balance: newBalance })
    .eq('wallet_address', wallet)

  // Insert transaction log (table may not exist yet)
  try {
    await supabaseAdmin
      .from('zxp_transactions')
      .insert({ wallet_address: wallet, type: 'claim', amount, note: 'Admin grant', balance_after: newBalance })
  } catch { /* table may not exist */ }

  return NextResponse.json({ ok: true, wallet, added: amount, balance: newBalance })
}
