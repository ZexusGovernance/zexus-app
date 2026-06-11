// One-off: tune the Community Burn Pool to a target total for testing.
// Inserts a single balancing 'burn' zxp_transaction (or trims if over target).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TARGET = Number(process.argv[2] ?? 490)

// Load .env.local manually (standalone node won't pick it up).
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()

const { data, error } = await supabase
  .from('zxp_transactions')
  .select('amount, note')
  .eq('type', 'burn')
  .gte('created_at', monthStart)

if (error) { console.error('read error', error); process.exit(1) }

const total = (data ?? [])
  .filter((r) => !String(r.note ?? '').startsWith('Epoch '))
  .reduce((s, r) => s + Math.abs(r.amount ?? 0), 0)

console.log('current burn pool total:', total)

const delta = TARGET - total
if (delta === 0) { console.log('already at target', TARGET); process.exit(0) }
if (delta < 0) {
  console.error(`pool is already ${total} (> ${TARGET}); refusing to delete history. Trim manually if needed.`)
  process.exit(1)
}

// zxp_transactions.wallet_address has an FK to profiles — attribute the test row
// to any existing profile so the constraint is satisfied.
const { data: anyProfile } = await supabase
  .from('profiles')
  .select('wallet_address')
  .limit(1)
  .single()

if (!anyProfile) { console.error('no profiles exist to attribute the row to'); process.exit(1) }

const { error: insErr } = await supabase.from('zxp_transactions').insert({
  wallet_address: anyProfile.wallet_address,
  type: 'burn',
  amount: -delta,
  note: `Manual test top-up — set burn pool to ${TARGET}`,
  balance_after: 0,
})

if (insErr) { console.error('insert error', insErr); process.exit(1) }
console.log(`inserted +${delta} burn → new total ${TARGET}`)
