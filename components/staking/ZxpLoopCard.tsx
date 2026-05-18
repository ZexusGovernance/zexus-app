'use client'

import { useState, useEffect } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'

export default function ZxpLoopCard() {
  const { address, isConnected } = useAppKitAccount()
  const { profile, refreshProfile } = useProfile()

  const [burnAmount, setBurnAmount]   = useState(5)
  const [burning, setBurning]         = useState(false)
  const [sessionBurned, setSessionBurned] = useState(0)
  const [burnMsg, setBurnMsg]         = useState<string | null>(null)
  const [claiming, setClaiming]       = useState(false)
  const [claimed, setClaimed]         = useState(false)
  const [claimMsg, setClaimMsg]       = useState<string | null>(null)
  const [todayEarned, setTodayEarned] = useState<number | null>(null)

  // Check today's claim status
  useEffect(() => {
    if (!address) return
    const today = new Date().toISOString().slice(0, 10)
    import('@/lib/supabase').then(({ supabase }) => {
      supabase
        .from('daily_checkins')
        .select('zxp_earned')
        .eq('wallet_address', address.toLowerCase())
        .eq('checkin_date', today)
        .maybeSingle()
        .then(({ data }) => {
          if (data) { setClaimed(true); setTodayEarned(data.zxp_earned) }
        })
    })
  }, [address])

  async function handleClaim() {
    if (!address || !isConnected) { setClaimMsg('Connect wallet first'); return }
    if (claimed) return
    setClaiming(true)
    try {
      const res = await fetch('/api/zxp/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      })
      const d = await res.json()
      if (d.already_claimed) {
        setClaimed(true); setTodayEarned(d.zxp_earned)
        setClaimMsg('Already claimed today!')
      } else if (res.ok) {
        setClaimed(true); setTodayEarned(d.zxp_earned)
        setClaimMsg(`+${d.zxp_earned} ZXP · Streak: ${d.new_streak} days!`)
        await refreshProfile(address)
      } else {
        setClaimMsg(d.error ?? 'Claim failed')
      }
    } catch { setClaimMsg('Network error') }
    setClaiming(false)
    setTimeout(() => setClaimMsg(null), 4000)
  }

  async function handleBurn() {
    if (!address || !isConnected) { setBurnMsg('Connect wallet first'); return }
    const free = profile?.zxp_balance ?? 0
    if (burnAmount > free) { setBurnMsg(`Not enough free ZXP (have ${free})`); return }
    setBurning(true)
    try {
      const res = await fetch('/api/zxp/burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, amount: burnAmount }),
      })
      const d = await res.json()
      if (res.ok) {
        setSessionBurned(b => b + burnAmount)
        setBurnMsg(`Burned ${burnAmount} ZXP → +${burnAmount * 2} Influence!`)
        await refreshProfile(address)
      } else {
        setBurnMsg(d.error ?? 'Burn failed')
      }
    } catch { setBurnMsg('Network error') }
    setBurning(false)
    setTimeout(() => setBurnMsg(null), 4000)
  }

  // In new model: zxp_balance = free, zxp_staked = staked separately
  const free    = profile?.zxp_balance ?? 0
  const staked  = profile?.zxp_staked  ?? 0
  const total   = free + staked
  const influence = free + staked * 1.0 + sessionBurned * 2

  return (
    <div className="zxp-loop-card">
      <div className="concept-head">
        <div>
          <div className="concept-title">ZXP Loop</div>
          <div className="concept-sub">Earn → Stake → Burn → Influence</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>
          <div>Total: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{total} ZXP</span></div>
          <div>Free: {free} · Staked: {staked}</div>
        </div>
      </div>

      <div className="zxp-flow">
        <div className="zxp-step step-earn"><div className="zxp-step-icon"><i className="ti ti-coin"></i></div><div className="zxp-step-num">1</div><div className="zxp-step-title">Earn</div><div className="zxp-step-text">Verdicts, staking, check-ins</div></div>
        <div className="zxp-step step-stake"><div className="zxp-step-icon"><i className="ti ti-lock"></i></div><div className="zxp-step-num">2</div><div className="zxp-step-title">Stake</div><div className="zxp-step-text">Lock for APY + multiplier</div></div>
        <div className="zxp-step step-burn"><div className="zxp-step-icon"><i className="ti ti-flame"></i></div><div className="zxp-step-num">3</div><div className="zxp-step-title">Burn</div><div className="zxp-step-text">Boost your influence weight</div></div>
        <div className="zxp-step step-inf"><div className="zxp-step-icon"><i className="ti ti-shield-check"></i></div><div className="zxp-step-num">4</div><div className="zxp-step-title">Influence</div><div className="zxp-step-text">Higher weight in verdicts</div></div>
      </div>

      <div className="zxp-demo-controls">
        {/* Daily claim */}
        <div className="zxp-control">
          <div className="zxp-control-label">Daily Claim</div>
          <div className="zxp-control-value">
            {claimed ? `+${todayEarned ?? '?'} ZXP ✓` : `+1–5 ZXP`}
          </div>
          {claimMsg && (
            <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 6, textAlign: 'center' }}>
              {claimMsg}
            </div>
          )}
          <button
            className="zxp-claim-btn"
            onClick={handleClaim}
            disabled={claimed || claiming || !isConnected}
            style={claimed || !isConnected ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            <i className="ti ti-coin"></i>
            {claiming ? 'Claiming…' : claimed ? 'Claimed today!' : 'Claim'}
          </button>
          {profile?.claim_streak ? (
            <div style={{ fontSize: 10, color: 'var(--muted2)', textAlign: 'center', marginTop: 4 }}>
              🔥 {profile.claim_streak}-day streak
            </div>
          ) : null}
        </div>

        {/* Burn ZXP */}
        <div className="zxp-control">
          <div className="zxp-control-label">Burn ZXP</div>
          <div className="zxp-control-value">{burnAmount} ZXP</div>
          <div className="zxp-progress">
            <div className="zxp-progress-fill" style={{ width: `${(burnAmount / Math.max(10, free)) * 100}%` }}></div>
          </div>
          <input
            type="range" min={1} max={Math.max(10, free)} value={burnAmount}
            onChange={e => setBurnAmount(Number(e.target.value))}
            style={{ width: '100%', margin: '4px 0 8px', accentColor: '#ff9a9a' }}
          />
          <div className="zxp-btn-row">
            {[1, 5, 10].map(v => (
              <span key={v} className="burn-pill" style={{ cursor: 'pointer' }}
                onClick={() => setBurnAmount(Math.min(v, free))}>{v} ZXP</span>
            ))}
          </div>
          {burnMsg && (
            <div style={{ fontSize: 11, color: sessionBurned > 0 ? 'var(--green)' : 'var(--red)', marginBottom: 6, textAlign: 'center' }}>
              {burnMsg}
            </div>
          )}
          <button
            className="bet-btn bb-no"
            style={{ width: '100%', marginTop: '8px' }}
            onClick={handleBurn}
            disabled={burning || !isConnected || free < burnAmount}
          >
            <i className="ti ti-flame"></i>
            {burning ? 'Burning…' : `Burn ${burnAmount} ZXP`}
          </button>
          {sessionBurned > 0 && (
            <div style={{ fontSize: 10, color: 'var(--muted2)', textAlign: 'center', marginTop: 4 }}>
              Burned this session: {sessionBurned} ZXP
            </div>
          )}
        </div>

        {/* Influence */}
        <div className="zxp-control">
          <div className="zxp-control-label">Influence</div>
          <div className="zxp-control-value" style={{ color: 'var(--green)', fontSize: '22px' }}>{Math.round(influence)}</div>
          <div className="zxp-progress">
            <div className="zxp-progress-fill" style={{ width: `${Math.min((influence / 600) * 100, 100)}%` }}></div>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted2)', lineHeight: 1.5 }}>
            {free} free + {staked} staked
            {sessionBurned > 0 && ` + ${sessionBurned * 2} burn boost`}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted2)', marginTop: 4 }}>
            Burn ZXP to permanently increase influence
          </div>
        </div>
      </div>
    </div>
  )
}
