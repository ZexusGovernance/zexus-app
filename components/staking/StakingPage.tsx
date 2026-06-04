'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'
import ZxpLoopCard from './ZxpLoopCard'
import ApyChart from './ApyChart'

type StakingTab = 'My stake' | 'History' | 'Epoch'
type HistoryFilter = 'all' | 'stake' | 'unstake' | 'burn' | 'reward'
type HistoryRange = 'all' | 'week' | 'month' | 'halfyear'

// URL slug <-> tab. 'My stake' is the default and keeps the URL clean (/staking).
const TAB_TO_SLUG: Record<StakingTab, string> = { 'My stake': '', History: 'history', Epoch: 'epoch' }
const SLUG_TO_TAB: Record<string, StakingTab> = { history: 'History', epoch: 'Epoch' }

// Date-range presets for the History tab calendar filter
const HISTORY_RANGES: { id: HistoryRange; label: string; days: number | null }[] = [
  { id: 'all',      label: 'All time',      days: null },
  { id: 'week',     label: 'Last week',     days: 7   },
  { id: 'month',    label: 'Last month',    days: 30  },
  { id: 'halfyear', label: 'Last 6 months', days: 182 },
]

interface Position {
  id: string
  amount: number
  staked_at: string
  status: 'active' | 'unstaking'
  accrued_rewards: number
  multiplier: number       // APY accrual multiplier
  vote_multiplier: number  // vote power multiplier
  days_staked: number
  unstake_available_at: string | null
  cooldown_remaining_seconds: number | null
}

interface TxRow {
  id: string
  type: string
  amount: number
  note: string | null
  balance_after: number
  created_at: string
}

function fmtSeconds(s: number): string {
  if (s <= 0) return '0s'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}m ${sec}s`
}

const EPOCHS = [
  { label: 'Tier I',   goal: 500,  perk: '+5% Influence bonus' },
  { label: 'Tier II',  goal: 1500, perk: '+1.1x multiplier' },
  { label: 'Tier III', goal: 4500, perk: 'Genesis Badge' },
  { label: 'Tier IV',  goal: 8500, perk: 'Legacy Status' },
]

function EpochProgress({ totalBurned }: { totalBurned: number }) {
  const nextIdx  = EPOCHS.findIndex(e => totalBurned < e.goal)
  const curIdx   = nextIdx === -1 ? EPOCHS.length - 1 : Math.max(0, nextIdx - 1)
  const next     = EPOCHS[nextIdx === -1 ? EPOCHS.length - 1 : nextIdx]
  const prevGoal = curIdx > 0 ? EPOCHS[curIdx - 1].goal : 0
  const pct      = nextIdx === -1 ? 100 : Math.min(100, ((totalBurned - prevGoal) / (next.goal - prevGoal)) * 100)

  return (
    <div className="panel" style={{ padding: '13px 15px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 4,
              background: 'rgba(111,155,229,0.1)', color: '#7a9fd9',
              border: '0.5px solid rgba(111,155,229,0.2)',
            }}>
              {EPOCHS[curIdx]?.label ?? 'Tier IV'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>
              {nextIdx === -1 ? 'Max reached' : `${totalBurned} / ${next.goal} ZXP`}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            {nextIdx === -1 ? 'Legacy Status unlocked' : `Next: ${next.perk}`}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
          {Math.round(pct)}%
        </div>
      </div>

      {/* Main bar */}
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${pct}%`,
          background: 'linear-gradient(to right, rgba(111,155,229,0.6), rgba(83,201,146,0.8))',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Tier steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {EPOCHS.map((e, i) => {
          const done = totalBurned >= e.goal
          const active = i === curIdx
          return (
            <div key={e.label} style={{
              padding: '7px 8px', borderRadius: 7,
              background: done ? 'rgba(83,201,146,0.06)' : 'rgba(255,255,255,0.03)',
              border: `0.5px solid ${active ? 'rgba(111,155,229,0.3)' : done ? 'rgba(83,201,146,0.2)' : 'var(--border)'}`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: done ? 'var(--green)' : active ? '#7a9fd9' : 'var(--muted2)', marginBottom: 2 }}>{e.label}</div>
              <div style={{ fontSize: 9, color: 'var(--muted2)' }}>{e.goal} ZXP</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface EpochInfo {
  epoch_number:        number
  epoch_start:         string
  epoch_end:           string
  days_until_end:      number
  apy_percent:         string
  emergency_call_cost: number
  median_balance:      number
  voting_post_cost:    number
}

function EpochStat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 3 }}>{k}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color ?? 'var(--text)' }}>{v}</div>
    </div>
  )
}

function EpochCard() {
  const [e, setE] = useState<EpochInfo | null>(null)
  useEffect(() => {
    fetch('/api/epoch')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && !d.error) setE(d) })
      .catch(() => {})
  }, [])
  if (!e) return null

  const start   = new Date(e.epoch_start).getTime()
  const end     = new Date(e.epoch_end).getTime()
  const pct     = end > start ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : 0
  const ending  = e.days_until_end <= 14

  return (
    <div className="panel" style={{ padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
            padding: '3px 9px', borderRadius: 5,
            background: 'rgba(201,165,90,0.12)', color: 'var(--gold)',
            border: '0.5px solid rgba(201,165,90,0.3)',
          }}>
            Epoch {e.epoch_number}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Governance cycle · 6 months</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: ending ? 'var(--gold)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="ph-bold ph-clock" /> {e.days_until_end}d left
        </span>
      </div>

      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: 'linear-gradient(to right, rgba(201,165,90,0.55), rgba(201,165,90,0.95))',
          transition: 'width 0.4s ease',
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <EpochStat k="Staking APY"    v={`${e.apy_percent}%`}            color="var(--green)" />
        <EpochStat k="Emergency Call" v={`${e.emergency_call_cost} ZXP`} />
        <EpochStat k="Median wallet"  v={`${e.median_balance} ZXP`} />
        <EpochStat k="Voting post"    v={e.voting_post_cost > 0 ? `${e.voting_post_cost} ZXP` : 'Free'} color={e.voting_post_cost > 0 ? undefined : 'var(--green)'} />
      </div>

      <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 10, lineHeight: 1.5 }}>
        At epoch end, idle ZXP decays — stake or cast 3+ votes to keep 100%. Attack costs re-peg to the median wallet.
      </div>
    </div>
  )
}

const TX_META: Record<string, { icon: string; label: string; color: string }> = {
  stake:      { icon: 'ph-bold ph-arrow-circle-down', label: 'Staked',     color: '#6f9be5' },
  unstake:    { icon: 'ph-bold ph-arrow-circle-up',   label: 'Unstaked',   color: 'var(--muted)' },
  burn:       { icon: 'ph-bold ph-flame',             label: 'Burned',     color: 'rgba(255,180,100,0.85)' },
  reward:     { icon: 'ph-bold ph-star',              label: 'Reward',     color: 'var(--green)' },
  claim:      { icon: 'ph-bold ph-calendar-check',   label: 'Check-in',   color: 'var(--green)' },
  checkin:    { icon: 'ph-bold ph-calendar-check',   label: 'Check-in',   color: 'var(--green)' },
  verdict:    { icon: 'ph-bold ph-shield-check',     label: 'Verdict',    color: 'var(--green)' },
  referral:   { icon: 'ph-bold ph-users',            label: 'Referral',   color: 'var(--green)' },
  onboarding: { icon: 'ph-bold ph-rocket-launch',    label: 'Onboarding', color: 'var(--green)' },
}

const MILESTONES = [
  { days: 30,  minAmount: 20,  reward: 10  },
  { days: 90,  minAmount: 50,  reward: 25  },
  { days: 180, minAmount: 100, reward: 60  },
  { days: 365, minAmount: 250, reward: 150 },
]

interface MilestoneState {
  position_id: string
  milestone_days: number
  min_amount: number
  reward: number
  reached: boolean
  claimed: boolean
  claimable: boolean
  days_staked: number
  position_amount: number
}

export default function StakingPage() {
  const router    = useRouter()
  const pathname  = usePathname()
  const params    = useSearchParams()
  const urlTab    = SLUG_TO_TAB[params.get('tab') ?? ''] ?? 'My stake'

  const [activeTab, setActiveTab] = useState<StakingTab>(urlTab)
  // Keep the active tab in sync with the URL (deep links, back/forward, F5)
  useEffect(() => { setActiveTab(urlTab) }, [urlTab])

  const selectTab = (t: StakingTab) => {
    setActiveTab(t)
    const slug = TAB_TO_SLUG[t]
    router.replace(slug ? `${pathname}?tab=${slug}` : pathname, { scroll: false })
  }

  const { address, isConnected } = useAppKitAccount()
  const { profile, refreshProfile } = useProfile()

  const [positions,   setPositions]   = useState<Position[]>([])
  const [milestones,  setMilestones]  = useState<MilestoneState[]>([])
  const [claimingMs,  setClaimingMs]  = useState<string | null>(null)
  const [history, setHistory]         = useState<TxRow[]>([])
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [historyRange,  setHistoryRange]  = useState<HistoryRange>('all')
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false)
  const [stakeAmount, setStakeAmount] = useState('')
  const [loading, setLoading]         = useState(false)
  const [actionMsg, setActionMsg]     = useState<string | null>(null)
  const [poolTotal, setPoolTotal]     = useState<number | null>(null)
  const [apyBps,    setApyBps]        = useState(800)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [tick, setTick] = useState(0)
  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const loadPositions = useCallback(async (wallet: string) => {
    const res = await fetch(`/api/zxp/positions?wallet=${wallet}`)
    if (res.ok) {
      const d = await res.json()
      setPositions(d.positions ?? [])
      if (d.apy_bps != null) setApyBps(d.apy_bps)
    }
  }, [])

  const loadMilestones = useCallback(async (wallet: string) => {
    const res = await fetch(`/api/zxp/milestones?wallet=${wallet}`)
    if (res.ok) {
      const d = await res.json()
      setMilestones(d.milestones ?? [])
    }
  }, [])

  const loadHistory = useCallback(async (wallet: string) => {
    const { supabase } = await import('@/lib/supabase')
    const w = wallet.toLowerCase()

    // Exclude 'claim' from transactions — we use daily_checkins as the source of truth
    const { data: txData } = await supabase
      .from('zxp_transactions')
      .select('id, type, amount, note, balance_after, created_at')
      .eq('wallet_address', w)
      .not('type', 'eq', 'claim')
      .order('created_at', { ascending: false })
      .limit(100)

    // All daily checkins → shown as type 'checkin'
    const { data: checkinData } = await supabase
      .from('daily_checkins')
      .select('id, checkin_date, zxp_earned, streak_day, created_at')
      .eq('wallet_address', w)
      .order('created_at', { ascending: false })
      .limit(100)

    const checkinRows: TxRow[] = (checkinData ?? []).map(c => ({
      id: `ci-${c.id}`,
      type: 'checkin',
      amount: c.zxp_earned,
      note: `Daily check-in — streak day ${c.streak_day}`,
      balance_after: 0,
      created_at: c.created_at,
    }))

    const merged = [...(txData ?? []), ...checkinRows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100)

    setHistory(merged)
  }, [])

  useEffect(() => {
    if (!address) return
    loadPositions(address)
    loadHistory(address)
    loadMilestones(address)
  }, [address, loadPositions, loadHistory, loadMilestones])

  useEffect(() => {
    fetch('/api/zxp/pool')
      .then(r => r.json())
      .then(d => setPoolTotal(d.total ?? 0))
      .catch(() => setPoolTotal(0))
  }, [])

  // Refetch positions every 60 s so accrued rewards drip visibly
  useEffect(() => {
    if (!address) return
    const interval = setInterval(() => loadPositions(address), 60_000)
    return () => clearInterval(interval)
  }, [address, loadPositions])

  const toast = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3000)
  }

  async function claimMilestone(positionId: string, milestoneDays: number, reward: number) {
    if (!address || claimingMs) return
    const key = `${positionId}:${milestoneDays}`
    setClaimingMs(key)
    const res = await fetch('/api/zxp/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, position_id: positionId, milestone_days: milestoneDays }),
    })
    const d = await res.json()
    setClaimingMs(null)
    if (!res.ok) { toast(d.error ?? 'Claim failed'); return }
    toast(`+${reward} ZXP — ${milestoneDays}d milestone claimed!`)
    await Promise.all([loadMilestones(address), refreshProfile(address)])
  }

  async function handleStake() {
    if (!address) { toast('Connect your wallet first'); return }
    const amt = parseInt(stakeAmount)
    if (!amt || amt < 1) { toast('Enter a valid ZXP amount'); return }
    setLoading(true)
    const res = await fetch('/api/zxp/stake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, amount: amt }),
    })
    const d = await res.json()
    setLoading(false)
    if (!res.ok) { toast(d.error ?? 'Stake failed'); return }
    toast(`Staked ${amt} ZXP!`)
    setStakeAmount('')
    await loadPositions(address)
    await refreshProfile(address)
  }

  async function handleUnstakeRequest(posId: string) {
    if (!address) return
    setLoading(true)
    const res = await fetch('/api/zxp/unstake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, position_id: posId, action: 'request' }),
    })
    const d = await res.json()
    setLoading(false)
    if (!res.ok) { toast(d.error ?? 'Unstake failed'); return }
    toast(`Unstaking started — available in ${d.cooldown_minutes} min`)
    await loadPositions(address)
  }

  async function handleUnstakeComplete(posId: string) {
    if (!address) return
    setLoading(true)
    const res = await fetch('/api/zxp/unstake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, position_id: posId, action: 'complete' }),
    })
    const d = await res.json()
    setLoading(false)
    if (!res.ok) { toast(d.error ?? 'Cannot complete yet'); return }
    toast(`Unstaked! +${d.returned + d.rewards} ZXP returned`)
    await loadPositions(address)
    await loadHistory(address)
    await refreshProfile(address)
  }

  const free           = profile?.zxp_balance ?? 0
  const total          = free + (profile?.zxp_staked ?? 0)
  const totalStaked    = positions.filter(p => p.status === 'active').reduce((s, p) => s + p.amount, 0)
  const totalAccrued   = positions.reduce((s, p) => s + p.accrued_rewards, 0)
  const apyPct         = (apyBps / 100).toFixed(1)
  const maxVoteMult    = positions.filter(p => p.status === 'active').length
    ? Math.max(...positions.filter(p => p.status === 'active').map(p => p.vote_multiplier ?? 1.0))
    : 1.0
  // vote weight = sqrt(staked) × voteMultiplier  (matches vote/route.ts)
  const voteWeight     = Math.round(Math.sqrt(totalStaked) * maxVoteMult * 100) / 100
  const totalBurned    = profile?.zxp_burned ?? 0

  return (
    <div className="page active" id="page-staking">
      {actionMsg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 18px', fontSize: 13,
          color: 'var(--text)', zIndex: 9999, whiteSpace: 'nowrap',
        }}>{actionMsg}</div>
      )}

      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Header */}
        <div className="page-header">
          <div className="page-title">Staking ZXP</div>
          <div className="page-sub">Off-chain · Pool APY · Recalculated each epoch</div>
          <div style={{ display: 'flex', gap: 2, marginTop: 10 }}>
            {(['My stake', 'History', 'Epoch'] as StakingTab[]).map(t => (
              <button
                key={t}
                onClick={() => selectTab(t)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, padding: '6px 14px',
                  color: activeTab === t ? 'var(--text)' : 'var(--muted)',
                  borderBottom: activeTab === t ? '2px solid var(--text)' : '2px solid transparent',
                  transition: 'color 0.15s',
                }}
              >{t}</button>
            ))}
          </div>
        </div>

        <div className="scroll" style={{ paddingBottom: 24 }}>

          {/* Stat row — always visible */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Staked',  value: String(profile?.zxp_staked ?? '—'), sub: 'ZXP locked',    dot: '#6f9be5',       color: 'var(--text)' },
              { label: 'APY',     value: `${apyPct}%`,                         sub: 'pool rate',     dot: 'var(--green)',  color: 'var(--green)' },
              { label: 'Rewards', value: `+${totalAccrued}`,                   sub: 'accrued · /hr', dot: 'var(--green)',  color: totalAccrued > 0 ? 'var(--green)' : 'var(--muted)' },
            ].map(({ label, value, sub, dot, color }) => (
              <div key={label} className="panel" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1, marginBottom: 3 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ── My stake ── */}
          {activeTab === 'My stake' && (
            <>
              {/* APY Rate */}
              <div className="apy-block" style={{ marginBottom: 10 }}>
                <div className="apy-block-top">
                  <div>
                    <div className="apy-block-title">APY Rate</div>
                    <div className="apy-block-sub">Floating · Recalculated weekly</div>
                  </div>
                  <div className="apy-pill">
                    <div className="apy-num">{apyPct}%</div>
                    <div className="apy-lbl">Pool: {poolTotal === null ? '…' : poolTotal.toLocaleString()} ZXP</div>
                  </div>
                </div>
                <ApyChart currentApy={apyBps / 100} />
              </div>

              {/* Layer 1 — Off-chain */}
              <div className="layer-card" style={{ marginBottom: 10 }}>
                <div className="layer-head">
                  <div className="layer-title-row">
                    <span className="layer-badge lb-l1">Layer 1</span>
                    <div>
                      <div className="layer-name">Off-chain staking</div>
                      <div className="layer-desc">No gas · Instant entry</div>
                    </div>
                  </div>
                  <div className="apy-pill">
                    <div className="apy-num">{apyPct}%</div>
                    <div className="apy-lbl">APY</div>
                  </div>
                </div>

                <div className="layer-body">
                  {/* Active positions */}
                  {positions.filter(p => p.status === 'active').map(p => (
                    <div key={p.id} style={{
                      marginBottom: 8, padding: '10px 12px',
                      background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                      border: '0.5px solid var(--border)',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 8 }}>
                        {[
                          { label: 'Staked',       value: `${p.amount} ZXP`,                        color: 'var(--text)' },
                          { label: 'Days',         value: `${p.days_staked}d`,                      color: 'var(--text)' },
                          { label: 'Vote mult',    value: `${(p.vote_multiplier ?? 1).toFixed(1)}x`, color: 'var(--green)' },
                          { label: 'Rewards',      value: `+${p.accrued_rewards}`,                  color: 'var(--green)' },
                        ].map(({ label, value, color }) => (
                          <div key={label}>
                            <div style={{ fontSize: 9, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Milestones for this position */}
                      {(() => {
                        const posMilestones = milestones.filter(m => m.position_id === p.id)
                        if (posMilestones.length === 0) return null
                        return (
                          <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {posMilestones.map(m => {
                              const key = `${m.position_id}:${m.milestone_days}`
                              const isClaiming = claimingMs === key
                              if (m.claimed) return (
                                <div key={m.milestone_days} style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                                  background: 'rgba(83,201,146,0.07)', border: '0.5px solid rgba(83,201,146,0.22)',
                                  color: 'var(--green)',
                                }}>
                                  <i className="ph-bold ph-check" style={{ fontSize: 9 }} />
                                  {m.milestone_days}d
                                </div>
                              )
                              if (m.claimable) return (
                                <button
                                  key={m.milestone_days}
                                  onClick={() => claimMilestone(m.position_id, m.milestone_days, m.reward)}
                                  disabled={!!claimingMs}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                    background: 'rgba(201,165,90,0.12)', border: '0.5px solid rgba(201,165,90,0.4)',
                                    color: 'var(--gold)', cursor: claimingMs ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', opacity: isClaiming ? 0.6 : 1,
                                  }}
                                >
                                  <i className="ph-bold ph-gift" style={{ fontSize: 9 }} />
                                  {isClaiming ? '…' : `${m.milestone_days}d +${m.reward} ZXP`}
                                </button>
                              )
                              // Not yet reached
                              return (
                                <div key={m.milestone_days} style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '3px 8px', borderRadius: 6, fontSize: 10,
                                  background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)',
                                  color: 'var(--muted2)',
                                }}>
                                  <i className="ph-bold ph-lock" style={{ fontSize: 9 }} />
                                  {m.milestone_days}d ({m.days_staked}d/{m.milestone_days}d)
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}

                      <button
                        onClick={() => handleUnstakeRequest(p.id)}
                        disabled={loading}
                        style={{
                          width: '100%', padding: '7px', fontSize: 11, fontWeight: 600,
                          background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--border)',
                          borderRadius: 6, color: 'var(--muted)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        }}
                      >
                        <i className="ph-bold ph-lock-open" /> Request Unstake
                      </button>
                    </div>
                  ))}

                  {/* Unstaking positions */}
                  {positions.filter(p => p.status === 'unstaking').map(p => {
                    const secsLeft = p.unstake_available_at
                      ? Math.max(0, Math.ceil((new Date(p.unstake_available_at).getTime() - Date.now()) / 1000))
                      : 0
                    const ready = secsLeft <= 0
                    return (
                      <div key={p.id} style={{
                        marginBottom: 8, padding: '10px 12px', borderRadius: 8,
                        background: ready ? 'rgba(83,201,146,0.04)' : 'rgba(255,255,255,0.03)',
                        border: `0.5px solid ${ready ? 'rgba(83,201,146,0.2)' : 'var(--border)'}`,
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                          Unstaking <strong style={{ color: 'var(--text)' }}>{p.amount} ZXP</strong>
                          {' · '}
                          {ready
                            ? <span style={{ color: 'var(--green)' }}>Ready to claim!</span>
                            : `Available in ${fmtSeconds(secsLeft)}`}
                        </div>
                        <button
                          onClick={() => handleUnstakeComplete(p.id)}
                          disabled={!ready || loading}
                          style={{
                            width: '100%', padding: '7px', fontSize: 11, fontWeight: 600,
                            background: ready ? 'var(--green)' : 'rgba(255,255,255,0.04)',
                            border: `0.5px solid ${ready ? 'var(--green)' : 'var(--border)'}`,
                            borderRadius: 6, color: ready ? '#000' : 'var(--muted)',
                            cursor: ready ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {ready ? `Claim ${p.amount + p.accrued_rewards} ZXP` : 'Waiting…'}
                        </button>
                      </div>
                    )
                  })}

                  {positions.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '16px 0 8px', color: 'var(--muted)', fontSize: 12 }}>
                      No active positions
                    </div>
                  )}

                  {/* Stake input */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <input
                      className="zxp-input"
                      type="number"
                      placeholder={`Free: ${free} ZXP`}
                      value={stakeAmount}
                      onChange={e => setStakeAmount(e.target.value)}
                      min={1} max={free}
                      style={{ flex: 1 }}
                    />
                    <button className="max-btn" onClick={() => setStakeAmount(String(free))}>MAX</button>
                    <button
                      className="stake-btn sb-l1"
                      onClick={handleStake}
                      disabled={loading || !isConnected}
                    >
                      {loading ? '…' : 'Stake'}
                    </button>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
                    Vote bonus: 30d → 1.2x · 90d → 1.5x · 180d → 1.8x · 365d → 2.2x
                  </div>
                </div>
              </div>

              {/* Layer 2 — On-chain (locked) */}
              <div className="layer-card" style={{ opacity: 0.5 }}>
                <div className="layer-head lh-l2">
                  <div className="layer-title-row">
                    <span className="layer-badge lb-l2">Layer 2</span>
                    <div>
                      <div className="layer-name">On-chain · Base Mainnet</div>
                      <div className="layer-desc">Coming soon · Smart contract</div>
                    </div>
                  </div>
                  <div className="apy-pill">
                    <div className="apy-num" style={{ color: 'var(--muted)' }}>14%</div>
                    <div className="apy-lbl">APY</div>
                  </div>
                </div>
                <div className="layer-body" style={{ textAlign: 'center', padding: '22px', color: 'var(--muted)', fontSize: 12 }}>
                  <i className="ph-bold ph-lock" style={{ fontSize: 20, display: 'block', marginBottom: 6 }} />
                  On-chain staking launches with the Base smart contract.
                </div>
              </div>
            </>
          )}

          {/* ── History ── */}
          {activeTab === 'History' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Filter pills + date-range calendar */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {(['all', 'stake', 'unstake', 'burn', 'reward'] as HistoryFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    style={{
                      padding: '4px 11px', fontSize: 11, fontWeight: 500, borderRadius: 20,
                      background: historyFilter === f ? 'rgba(111,155,229,0.15)' : 'transparent',
                      border: 'none', outline: 'none',
                      color: historyFilter === f ? '#7a9fd9' : 'var(--muted)',
                      cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >{f}</button>
                ))}

                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                  <button
                    onClick={() => setRangeMenuOpen(o => !o)}
                    title="Filter by date"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', fontSize: 11, fontWeight: 500, borderRadius: 20,
                      background: historyRange !== 'all' ? 'rgba(111,155,229,0.15)' : 'transparent',
                      border: 'none', outline: 'none', cursor: 'pointer',
                      color: historyRange !== 'all' ? '#7a9fd9' : 'var(--muted)',
                    }}
                  >
                    <i className="ph-bold ph-calendar-blank" style={{ fontSize: 14 }} />
                    {historyRange !== 'all' && (
                      <span>{HISTORY_RANGES.find(r => r.id === historyRange)?.label}</span>
                    )}
                  </button>

                  {rangeMenuOpen && (
                    <>
                      <div
                        onClick={() => setRangeMenuOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                      />
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 11,
                        minWidth: 150, padding: 4,
                        background: 'var(--bg)', border: '0.5px solid var(--border2)',
                        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
                      }}>
                        {HISTORY_RANGES.map(r => (
                          <button
                            key={r.id}
                            onClick={() => { setHistoryRange(r.id); setRangeMenuOpen(false) }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: '8px 10px', fontSize: 12, fontWeight: 500,
                              background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer',
                              textAlign: 'left',
                              color: historyRange === r.id ? '#7a9fd9' : 'var(--text)',
                            }}
                          >
                            {r.label}
                            {historyRange === r.id && <i className="ph-bold ph-check" style={{ fontSize: 12 }} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {(() => {
                const rangeDays = HISTORY_RANGES.find(r => r.id === historyRange)?.days ?? null
                const cutoff = rangeDays ? Date.now() - rangeDays * 86_400_000 : 0
                const byType = historyFilter === 'all'
                  ? history
                  : history.filter(tx => {
                      if (historyFilter === 'reward') return tx.type === 'reward' || tx.type === 'checkin' || tx.type === 'verdict' || tx.type === 'onboarding'
                      return tx.type === historyFilter
                    })
                const filtered = cutoff
                  ? byType.filter(tx => new Date(tx.created_at).getTime() >= cutoff)
                  : byType
                if (filtered.length === 0) return (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>
                    No transactions yet
                  </div>
                )
                return filtered.map((tx, i) => {
                  const m = TX_META[tx.type] ?? { icon: 'ph-bold ph-circle', label: tx.type, color: 'var(--muted)' }
                  const amtPos = tx.amount > 0
                  const amtColor = tx.type === 'burn' ? 'rgba(255,180,100,0.85)' : amtPos ? 'var(--green)' : 'var(--muted)'
                  const date = new Date(tx.created_at)
                  return (
                    <div key={tx.id} style={{
                      padding: '9px 2px',
                      borderBottom: i < filtered.length - 1 ? '0.5px solid rgba(232,228,220,0.042)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                        background: 'rgba(255,255,255,0.055)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className={m.icon} style={{ color: m.color, fontSize: 14 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{m.label}</div>
                        {tx.note && (
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.note}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: amtColor }}>
                          {amtPos ? '+' : ''}{tx.amount} ZXP
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 1 }}>
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {/* ── Epoch ── */}
          {activeTab === 'Epoch' && (
            <>
              <EpochCard />
              <div style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted2)', margin: '4px 0 8px' }}>
                Burn Tiers
              </div>
              <EpochProgress totalBurned={totalBurned} />
              <ZxpLoopCard />
            </>
          )}

        </div>
      </div>

      {/* Right sidebar */}
      <div className="right">
        <div className="panel">
          <div className="panel-title">ZXP balance</div>
          <div className="zxp-big">{total}</div>
          <div className="zxp-sub">Zexus Points</div>
          <div className="zxp-bar-row">
            <span className="zbl">Staked</span>
            <div className="zbw">
              <div className="zbf" style={{ width: total ? `${Math.round(((profile?.zxp_staked ?? 0) / total) * 100)}%` : '0%', background: '#6f9be5' }} />
            </div>
            <span className="zbv">{profile?.zxp_staked ?? 0}</span>
          </div>
          <div className="zxp-bar-row">
            <span className="zbl">Free</span>
            <div className="zbw">
              <div className="zbf" style={{ width: total ? `${Math.round((free / total) * 100)}%` : '0%', background: 'var(--green)' }} />
            </div>
            <span className="zbv">{free}</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">My status</div>
          <div className="s-row"><span className="s-k">Rank</span><span className="s-v" style={{ color: '#6f9be5' }}>#{profile?.rank ?? '—'}</span></div>
          <div className="s-row">
            <span className="s-k">Vote mult</span>
            <span className="s-v green">{maxVoteMult.toFixed(1)}x</span>
          </div>
          <div className="s-row"><span className="s-k">Streak</span><span className="s-v">{profile?.claim_streak ?? 0} days</span></div>
          <div className="s-row">
            <span className="s-k">Vote weight</span>
            <span className="s-v green" title={`√${totalStaked} × ${maxVoteMult.toFixed(1)}`}>
              {totalStaked > 0 ? voteWeight : '—'}
            </span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Vote power table</div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 8, lineHeight: 1.5 }}>
            Weight = √(staked) × time bonus
          </div>
          <div className="genesis-row"><div className="gen-tier">&lt; 30d</div><div className="gen-req">no bonus</div><div className="gen-mult">1.0x</div></div>
          <div className="genesis-row"><div className="gen-tier">30d</div><div className="gen-req">+20%</div><div className="gen-mult">1.2x</div></div>
          <div className="genesis-row"><div className="gen-tier">90d</div><div className="gen-req">+50%</div><div className="gen-mult">1.5x</div></div>
          <div className="genesis-row"><div className="gen-tier">180d</div><div className="gen-req">+80%</div><div className="gen-mult">1.8x</div></div>
          <div className="genesis-row"><div className="gen-tier">365d</div><div className="gen-req">+120%</div><div className="gen-mult">2.2x</div></div>
        </div>

        <div className="panel">
          <div className="panel-title">How to earn ZXP</div>
          <div className="rule-row"><i className="ph-bold ph-calendar-check" style={{ color: 'var(--muted)', fontSize: '13px', flexShrink: 0, marginTop: '1px' }} /><div className="rule-text">Daily platform check-in</div></div>
          <div className="rule-row"><i className="ph-bold ph-shield-check" style={{ color: 'var(--muted)', fontSize: '13px', flexShrink: 0, marginTop: '1px' }} /><div className="rule-text">Correct project verdicts</div></div>
          <div className="rule-row"><i className="ph-bold ph-trophy" style={{ color: 'var(--muted)', fontSize: '13px', flexShrink: 0, marginTop: '1px' }} /><div className="rule-text">Winning bets in Predict</div></div>
          <div className="rule-row"><i className="ph-bold ph-users" style={{ color: 'var(--muted)', fontSize: '13px', flexShrink: 0, marginTop: '1px' }} /><div className="rule-text">New user referrals</div></div>
        </div>
      </div>
    </div>
  )
}
