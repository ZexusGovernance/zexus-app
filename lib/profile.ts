import { supabase } from './supabase'

export interface Profile {
  wallet_address: string
  display_name: string | null
  avatar_url: string | null
  zxp_balance: number
  zxp_staked: number
  claim_streak: number
  last_claim_at: string | null
  settings: Record<string, unknown>
  rank: number
}

export interface VerdictHistoryRow {
  id: string
  post_id: string | null
  post_title: string | null
  post_project: string | null
  verdict: 'yes' | 'no'
  was_correct: boolean | null
  zxp_earned: number
  created_at: string
}

export interface DailyCheckin {
  id: string
  checkin_date: string
  streak_day: number
  zxp_earned: number
  created_at: string
}

export interface WatchlistItem {
  project_id: string
  added_at: string
}

// Upsert profile via server-side API (uses service role key)
export async function upsertProfile(walletAddress: string): Promise<Profile | null> {
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress }),
    })
    if (!res.ok) return null
    const { profile } = await res.json()
    return profile as Profile
  } catch {
    return null
  }
}

// Fetch profile with rank computed server-side
export async function getProfileWithRank(walletAddress: string): Promise<Profile | null> {
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress }),
    })
    if (!res.ok) return null
    const { profile } = await res.json()
    return profile as Profile
  } catch {
    return null
  }
}

// No-op: daily claim is now user-initiated via Claim button, not auto on connect
export async function recordCheckin(_walletAddress: string): Promise<number> {
  return 0
}

export async function getTodayCheckin(walletAddress: string): Promise<DailyCheckin | null> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('daily_checkins')
    .select('id, checkin_date, streak_day, zxp_earned, created_at')
    .eq('wallet_address', walletAddress.toLowerCase())
    .eq('checkin_date', today)
    .maybeSingle()
  return data ?? null
}

export async function getVerdictHistory(walletAddress: string): Promise<VerdictHistoryRow[]> {
  const { data } = await supabase
    .from('verdict_history')
    .select('id, post_id, post_title, post_project, verdict, was_correct, zxp_earned, created_at')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function getWatchlist(walletAddress: string): Promise<WatchlistItem[]> {
  const { data } = await supabase
    .from('user_watchlist')
    .select('project_id, added_at')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('added_at', { ascending: false })
  return data ?? []
}

export async function updateSettings(walletAddress: string, settings: Record<string, unknown>): Promise<void> {
  await supabase
    .from('profiles')
    .update({ settings })
    .eq('wallet_address', walletAddress.toLowerCase())
}
