import { supabaseAdmin } from './supabase-server'

const REWARDS: Record<string, number> = {
  connect:   3,
  reaction:  1,
  comment:   2,
  watchlist: 1,
}

const WINDOW_DAYS = 7

export async function grantOnboardingReward(
  wallet: string,
  action: string,
): Promise<{ granted: boolean; zxp: number }> {
  const zxp = REWARDS[action] ?? 0
  if (!zxp) return { granted: false, zxp: 0 }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('zxp_balance, registered_at')
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (!profile) return { granted: false, zxp: 0 }

  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000
  const registeredAt = new Date(profile.registered_at ?? Date.now()).getTime()
  if (Date.now() - registeredAt > windowMs) return { granted: false, zxp: 0 }

  // Unique constraint prevents double-grant
  const { error } = await supabaseAdmin
    .from('onboarding_rewards')
    .insert({ wallet_address: wallet, action, zxp_earned: zxp })

  if (error) return { granted: false, zxp: 0 }

  const newBalance = (profile.zxp_balance ?? 0) + zxp
  await supabaseAdmin
    .from('profiles')
    .update({ zxp_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('wallet_address', wallet)

  await supabaseAdmin.from('zxp_transactions').insert({
    wallet_address: wallet,
    type: 'onboarding',
    amount: zxp,
    description: `Onboarding: ${action}`,
  })

  return { granted: true, zxp }
}

export async function getOnboardingStatus(wallet: string): Promise<{
  completed: string[]
  within_window: boolean
}> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('registered_at')
    .eq('wallet_address', wallet)
    .maybeSingle()

  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000
  const registeredAt = new Date(profile?.registered_at ?? Date.now()).getTime()
  const within_window = Date.now() - registeredAt <= windowMs

  const { data: rewards } = await supabaseAdmin
    .from('onboarding_rewards')
    .select('action')
    .eq('wallet_address', wallet)

  return {
    completed: (rewards ?? []).map(r => r.action),
    within_window,
  }
}
