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
        setBurnMsg(`Burned ${burnAmount} ZXP → +${burnAmount * 2} Influence`)
        await refreshProfile(address)
      } else {
        setBurnMsg(d.error ?? 'Burn failed')
      }
    } catch { setBurnMsg('Network error') }
    setBurning(false)
    setTimeout(() => setBurnMsg(null), 4000)
  }

  const free = profile?.zxp_balance ?? 0

  return (
    <div className="zxp-loop-card">
      <div className="concept-head">
        <div>
          <div className="concept-title">ZXP Loop</div>
          <div className="concept-sub">Burn ZXP to boost your influence weight</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>
          <div>Free: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{free} ZXP</span></div>
          {sessionBurned > 0 && (
            <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2 }}>
              +{sessionBurned * 2} Influence this session
            </div>
          )}
        </div>
      </div>

      {/* Amount */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{burnAmount} ZXP</span>
        </div>
        <input
          type="range" min={1} max={Math.max(10, free)} value={burnAmount}
          onChange={e => setBurnAmount(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'rgba(255,160,80,0.85)', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 5, 10].map(v => (
            <button
              key={v}
              onClick={() => setBurnAmount(Math.min(v, free))}
              style={{
                flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 500,
                background: burnAmount === v ? 'rgba(255,160,80,0.1)' : 'rgba(255,255,255,0.04)',
                border: 'none',
                borderRadius: 6,
                color: burnAmount === v ? 'rgba(255,190,110,0.9)' : 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              {v} ZXP
            </button>
          ))}
        </div>
      </div>

      {burnMsg && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>
          {burnMsg}
        </div>
      )}

      <button
        onClick={handleBurn}
        disabled={burning || !isConnected || free < burnAmount}
        style={{
          width: '100%', padding: '9px', fontSize: 12, fontWeight: 600,
          background: 'rgba(255,155,70,0.08)',
          border: '0.5px solid rgba(255,155,70,0.22)',
          borderRadius: 8, color: 'rgba(255,185,100,0.9)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: (burning || !isConnected || free < burnAmount) ? 0.4 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <i className="ph-bold ph-flame" />
        {burning ? 'Burning…' : `Burn ${burnAmount} ZXP`}
      </button>
    </div>
  )
}
