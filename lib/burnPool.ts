import { supabaseAdmin } from './supabase-server'

// Community Burn Pool — a shared, monthly co-op goal. Everyone's activity burns
// (votes, emergency calls, etc.) add to one pool. When the community crosses a
// tier, EVERYONE gets a staking-APY bonus for the rest of the month. Resets each
// calendar month automatically (we just sum burns since the 1st).

export interface BurnTier {
  label: string
  goal:  number
  bonus: number // extra staking APY (fraction), e.g. 0.02 = +2% APY for everyone
}

export const BURN_TIERS: BurnTier[] = [
  { label: 'Tier I',   goal: 500,  bonus: 0.01 },
  { label: 'Tier II',  goal: 1500, bonus: 0.02 },
  { label: 'Tier III', goal: 4500, bonus: 0.03 },
  { label: 'Tier IV',  goal: 9000, bonus: 0.05 },
]

export function monthStartISO(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

export function monthDaysLeft(d = new Date()): number {
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  return Math.max(0, Math.ceil((end.getTime() - d.getTime()) / 86_400_000))
}

export interface BurnPool {
  total:    number
  tierIdx:  number   // -1 = no tier reached yet
  bonus:    number   // active vote-power bonus from the current tier
  tiers:    BurnTier[]
  daysLeft: number
}

// Sum activity burns this month. Excludes the twice-a-year epoch-end decay
// (those rows are noted "Epoch <date> …") so the pool reflects real activity.
export async function getBurnPool(): Promise<BurnPool> {
  const { data } = await supabaseAdmin
    .from('zxp_transactions')
    .select('amount, note')
    .eq('type', 'burn')
    .gte('created_at', monthStartISO())

  const total = (data ?? [])
    .filter(r => !String(r.note ?? '').startsWith('Epoch '))
    .reduce((s, r) => s + Math.abs((r.amount as number) ?? 0), 0)

  let tierIdx = -1
  for (let i = 0; i < BURN_TIERS.length; i++) {
    if (total >= BURN_TIERS[i].goal) tierIdx = i
  }
  const bonus = tierIdx >= 0 ? BURN_TIERS[tierIdx].bonus : 0

  return { total, tierIdx, bonus, tiers: BURN_TIERS, daysLeft: monthDaysLeft() }
}
