import { supabaseAdmin } from './supabase-server'

// Rank a wallet by its TOTAL ZXP = free balance + staked. Staked ZXP counts so
// staking never lowers a user's rank. 1-based: rank = (profiles whose total is
// strictly greater) + 1, so ties share a rank. Returns 1 on any error.
export async function rankByTotalZxp(myTotal: number): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('zxp_balance, zxp_staked')
    const ahead = (data ?? []).filter(
      r =>
        ((r.zxp_balance as number) ?? 0) + ((r.zxp_staked as number) ?? 0) > myTotal,
    ).length
    return ahead + 1
  } catch {
    return 1
  }
}
