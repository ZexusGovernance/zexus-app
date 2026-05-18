'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'
import ZxpLoopCard from './ZxpLoopCard'
import ApyChart from './ApyChart'

type StakingTab = 'My stake' | 'History'

interface Position {
  id: string
  amount: number
  staked_at: string
  status: 'active' | 'unstaking'
  accrued_rewards: number
  multiplier: number
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

export default function StakingPage() {
  const [activeTab, setActiveTab] = useState<StakingTab>('My stake')
  const { address, isConnected } = useAppKitAccount()
  const { profile, refreshProfile } = useProfile()

  const [positions, setPositions] = useState<Position[]>([])
  const [history, setHistory] = useState<TxRow[]>([])
  const [stakeAmount, setStakeAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // countdown tick
  const [tick, setTick] = useState(0)
  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const loadPositions = useCallback(async (wallet: string) => {
    const res = await fetch(`/api/zxp/positions?wallet=${wallet}`)
    if (res.ok) { const d = await res.json(); setPositions(d.positions ?? []) }
  }, [])

  const loadHistory = useCallback(async (wallet: string) => {
    const { supabase } = await import('@/lib/supabase')
    const { data } = await supabase
      .from('zxp_transactions')
      .select('id, type, amount, note, balance_after, created_at')
      .eq('wallet_address', wallet.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory(data ?? [])
  }, [])

  useEffect(() => {
    if (!address) return
    loadPositions(address)
    loadHistory(address)
  }, [address, loadPositions, loadHistory])

  const toast = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3000)
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

  const free  = profile?.zxp_balance ?? 0
  const total = free + (profile?.zxp_staked ?? 0)
  const totalStaked = positions.filter(p => p.status === 'active').reduce((s, p) => s + p.amount, 0)
  const totalAccrued = positions.reduce((s, p) => s + p.accrued_rewards, 0)
  const maxMultiplier = positions.length
    ? Math.max(...positions.map(p => p.multiplier))
    : 1.0

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
        <div className="page-header">
          <div className="page-title">Staking ZXP</div>
          <div className="page-sub">Two layers · Floating APY · 5%-25% range</div>
          <div className="tabs">
            {(['My stake', 'History'] as StakingTab[]).map(t => (
              <div key={t} className={`tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>{t}</div>
            ))}
          </div>
        </div>
        <div className="scroll">
          {/* Summary strip */}
          <div className="summary">
            <div className="sum-card">
              <div className="sum-label">Staked</div>
              <div className="sum-val">{profile?.zxp_staked ?? '—'}</div>
              <div className="sum-sub">Layer 1</div>
            </div>
            <div className="sum-card">
              <div className="sum-label">APY</div>
              <div className="sum-val">8%</div>
              <div className="sum-sub">floating</div>
            </div>
            <div className="sum-card">
              <div className="sum-label">Rewards</div>
              <div className="sum-val" style={{ color: 'var(--green)' }}>+{totalAccrued}</div>
              <div className="sum-sub">accrued</div>
            </div>
          </div>

          {activeTab === 'My stake' && (
            <>
              {/* ZXP Loop + APY Chart row */}
              <div className="staking-row">
                <ZxpLoopCard />
                <div className="apy-block">
                  <div className="apy-block-top">
                    <div>
                      <div className="apy-block-title">APY - pool dynamics</div>
                      <div className="apy-block-sub">Recalculated weekly · Depends on pool size</div>
                    </div>
                    <div>
                      <div className="apy-now-lbl">Now</div>
                      <div className="apy-now-val">8%</div>
                    </div>
                  </div>
                  <div className="range-pills">
                    <div className="rpill rp-gold"><div className="rp-dot" style={{ background: 'var(--gold)' }}></div>Max 25%</div>
                    <div className="rpill rp-green"><div className="rp-dot" style={{ background: 'var(--green)' }}></div>Current 8%</div>
                    <div className="rpill rp-blue"><div className="rp-dot" style={{ background: 'var(--blue)' }}></div>Min 5%</div>
                  </div>
                  <ApyChart />
                  <div className="chart-footer">
                    <span>Pool: <span className="pool-hl">{totalStaked} ZXP staked</span></span>
                    <span>Recalc weekly</span>
                  </div>
                  <div className="apy-note">
                    <i className="ti ti-trending-down"></i>Pool grows → APY decreases. Genesis stakers lock their multiplier forever.
                  </div>
                </div>
              </div>

              {/* Layer 1 */}
              <div className="staking-row">
                <div className="layer-card">
                  <div className="layer-head lh-l1">
                    <div className="layer-title-row">
                      <span className="layer-badge lb-l1">Layer 1</span>
                      <div>
                        <div className="layer-name">Off-chain staking</div>
                        <div className="layer-desc">No gas · Instant entry</div>
                      </div>
                    </div>
                    <div className="apy-pill"><div className="apy-num">8%</div><div className="apy-lbl">APY</div></div>
                  </div>
                  <div className="layer-body">
                    {/* Active positions */}
                    {positions.filter(p => p.status === 'active').map(p => (
                      <div key={p.id} style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6 }}>
                        <div className="info-grid" style={{ marginBottom: 6 }}>
                          <div className="info-item"><div className="info-label">Staked</div><div className="info-val gold">{p.amount} ZXP</div></div>
                          <div className="info-item"><div className="info-label">Days</div><div className="info-val">{p.days_staked}d</div></div>
                          <div className="info-item"><div className="info-label">Multiplier</div><div className="info-val green">{p.multiplier.toFixed(2)}x</div></div>
                          <div className="info-item"><div className="info-label">Accrued</div><div className="info-val green">+{p.accrued_rewards} ZXP</div></div>
                        </div>
                        <button className="stake-btn sb-l1" style={{ width: '100%', padding: '7px', fontSize: 12 }}
                          onClick={() => handleUnstakeRequest(p.id)} disabled={loading}>
                          <i className="ti ti-lock-open"></i> Request Unstake
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
                        <div key={p.id} style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(224,112,112,0.06)', border: '1px solid rgba(224,112,112,0.2)', borderRadius: 6 }}>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                            Unstaking {p.amount} ZXP · {ready ? 'Ready!' : `Available in ${fmtSeconds(secsLeft)}`}
                          </div>
                          <button
                            className="stake-btn"
                            style={{ width: '100%', padding: '7px', fontSize: 12, background: ready ? 'var(--green)' : 'var(--surface2)', color: ready ? '#fff' : 'var(--muted)' }}
                            onClick={() => handleUnstakeComplete(p.id)}
                            disabled={!ready || loading}
                          >
                            {ready ? `Claim ${p.amount + p.accrued_rewards} ZXP` : 'Waiting…'}
                          </button>
                        </div>
                      )
                    })}

                    {/* No positions */}
                    {positions.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textAlign: 'center', padding: '12px 0' }}>
                        No active positions
                      </div>
                    )}

                    {/* Stake input */}
                    <div className="input-row">
                      <input
                        className="zxp-input"
                        type="number"
                        placeholder={`Free: ${free} ZXP`}
                        value={stakeAmount}
                        onChange={e => setStakeAmount(e.target.value)}
                        min={1}
                        max={free}
                      />
                      <button className="max-btn" onClick={() => setStakeAmount(String(free))}>MAX</button>
                      <button className="stake-btn sb-l1" onClick={handleStake} disabled={loading || !isConnected}>
                        {loading ? '…' : 'Stake'}
                      </button>
                    </div>
                    <div className="mult-note">
                      <i className="ti ti-info-circle"></i>30d → 1.05x &nbsp;·&nbsp; 90d → 1.1x &nbsp;·&nbsp; 180d → 1.2x &nbsp;·&nbsp; 365d → 1.35x
                    </div>
                  </div>
                </div>

                {/* Layer 2 — locked */}
                <div className="layer-card" style={{ opacity: 0.55 }}>
                  <div className="layer-head lh-l2">
                    <div className="layer-title-row">
                      <span className="layer-badge lb-l2">Layer 2</span>
                      <div>
                        <div className="layer-name">On-chain · Base Mainnet</div>
                        <div className="layer-desc">Coming soon · Smart contract</div>
                      </div>
                    </div>
                    <div className="apy-pill"><div className="apy-num">14%</div><div className="apy-lbl">APY</div></div>
                  </div>
                  <div className="layer-body">
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 12 }}>
                      <i className="ti ti-lock" style={{ fontSize: 22, display: 'block', marginBottom: 6 }}></i>
                      On-chain staking launches with the Base smart contract.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'History' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {history.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>
                  No transactions yet
                </div>
              )}
              {history.map(tx => (
                <div key={tx.id} style={{
                  background: 'var(--surface2)', borderRadius: 8,
                  padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, textTransform: 'capitalize' }}>{tx.type}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{tx.note ?? ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: tx.amount > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} ZXP
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted2)' }}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="right">
        <div className="panel">
          <div className="panel-title">ZXP balance</div>
          <div className="zxp-big">{total}</div>
          <div className="zxp-sub">Zexus Points</div>
          <div className="zxp-bar-row">
            <span className="zbl">Staked</span>
            <div className="zbw">
              <div className="zbf" style={{
                width: total ? `${Math.round(((profile?.zxp_staked ?? 0) / total) * 100)}%` : '0%',
                background: 'var(--gold)',
              }}></div>
            </div>
            <span className="zbv">{profile?.zxp_staked ?? 0}</span>
          </div>
          <div className="zxp-bar-row">
            <span className="zbl">Free</span>
            <div className="zbw">
              <div className="zbf" style={{
                width: total ? `${Math.round((free / total) * 100)}%` : '0%',
                background: 'var(--green)',
              }}></div>
            </div>
            <span className="zbv">{free}</span>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">My status</div>
          <div className="s-row"><span className="s-k">Rank</span><span className="s-v gold">#{profile?.rank ?? '—'}</span></div>
          <div className="s-row"><span className="s-k">Multiplier</span><span className="s-v green">{maxMultiplier.toFixed(2)}x</span></div>
          <div className="s-row"><span className="s-k">Streak</span><span className="s-v">{profile?.claim_streak ?? 0} days</span></div>
          <div className="s-row"><span className="s-k">Influence</span><span className="s-v green">
            {Math.round(free + (profile?.zxp_staked ?? 0) * maxMultiplier)}
          </span></div>
        </div>
        <div className="panel">
          <div className="panel-title">Genesis multipliers</div>
          <div className="genesis-row"><div className="gen-tier">Tier 1</div><div className="gen-req">1,000 ZXP · 10 spots</div><div className="gen-mult">1.2x</div></div>
          <div className="genesis-row"><div className="gen-tier">Tier 2</div><div className="gen-req">500 ZXP · 50 spots</div><div className="gen-mult">1.15x</div></div>
          <div className="genesis-row"><div className="gen-tier">Tier 3</div><div className="gen-req">200 ZXP · 200 spots</div><div className="gen-mult">1.1x</div></div>
        </div>
        <div className="panel">
          <div className="panel-title">How to earn ZXP</div>
          <div className="rule-row"><i className="ti ti-calendar-check" style={{ color: 'var(--gold)', fontSize: '13px', flexShrink: 0, marginTop: '1px' }}></i><div className="rule-text">Daily platform check-in</div></div>
          <div className="rule-row"><i className="ti ti-shield-check" style={{ color: 'var(--gold)', fontSize: '13px', flexShrink: 0, marginTop: '1px' }}></i><div className="rule-text">Correct project verdicts</div></div>
          <div className="rule-row"><i className="ti ti-trophy" style={{ color: 'var(--gold)', fontSize: '13px', flexShrink: 0, marginTop: '1px' }}></i><div className="rule-text">Winning bets in Predict</div></div>
          <div className="rule-row"><i className="ti ti-users" style={{ color: 'var(--gold)', fontSize: '13px', flexShrink: 0, marginTop: '1px' }}></i><div className="rule-text">New user referrals</div></div>
        </div>
      </div>
    </div>
  )
}
