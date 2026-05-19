'use client'

import { useState } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'

export default function ZxpLoopCard() {
  const { address, isConnected } = useAppKitAccount()
  const { profile, refreshProfile } = useProfile()

  const [burnAmount, setBurnAmount]       = useState(5)
  const [burning, setBurning]             = useState(false)
  const [sessionBurned, setSessionBurned] = useState(0)
  const [burnMsg, setBurnMsg]             = useState<string | null>(null)

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

  const free  = profile?.zxp_balance ?? 0
  const staked = profile?.zxp_staked ?? 0

  return (
    <div className="zxp-loop-card">
      <div className="concept-head">
        <div>
          <div className="concept-title">ZXP Loop</div>
          <div className="concept-sub">Burn ZXP to boost your influence weight</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>
          <div>Free: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{free} ZXP</span></div>
          <div>Staked: {staked}</div>
        </div>
      </div>

      <div className="zxp-demo-controls" style={{ gridTemplateColumns: '1fr' }}>
        {/* Burn ZXP — full width */}
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
            <i className="ph-bold ph-flame"></i>
            {burning ? 'Burning…' : `Burn ${burnAmount} ZXP`}
          </button>
          {sessionBurned > 0 && (
            <div style={{ fontSize: 10, color: 'var(--muted2)', textAlign: 'center', marginTop: 4 }}>
              Burned this session: {sessionBurned} ZXP
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
