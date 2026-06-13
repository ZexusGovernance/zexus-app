'use client'

import { useState, useEffect } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'
import { localDateStr } from '@/lib/localDate'

interface Props {
  onClose: () => void
  onClaimed?: () => void
}

export default function CheckInModal({ onClose, onClaimed }: Props) {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { profile, refreshProfile } = useProfile()

  const [claimed, setClaimed]         = useState(false)
  const [todayEarned, setTodayEarned] = useState<number | null>(null)
  const [claiming, setClaiming]       = useState(false)
  const [msg, setMsg]                 = useState<string | null>(null)

  // Announce to the spotlight tour (it sits above this modal and hides itself
  // while we're open)
  useEffect(() => {
    window.dispatchEvent(new Event('zx:modal-open'))
    return () => window.dispatchEvent(new Event('zx:modal-closed'))
  }, [])

  useEffect(() => {
    if (!address) return
    const today = localDateStr()
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
    if (!isConnected) { open(); onClose(); return }
    if (claimed || claiming) return
    setClaiming(true)
    try {
      const res = await fetch('/api/zxp/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, date: localDateStr() }),
      })
      const d = await res.json()
      if (d.already_claimed) {
        setClaimed(true); setTodayEarned(d.zxp_earned)
        setMsg('Already claimed today!')
      } else if (res.ok) {
        setClaimed(true); setTodayEarned(d.zxp_earned)
        setMsg(`+${d.zxp_earned} ZXP · Streak: ${d.new_streak} days!`)
        if (address) await refreshProfile(address)
        onClaimed?.()
        window.dispatchEvent(new CustomEvent('zx:onboarding', { detail: 'checkin' }))
      } else {
        setMsg(d.error ?? 'Claim failed')
      }
    } catch { setMsg('Network error') }
    setClaiming(false)
    setTimeout(() => setMsg(null), 4000)
  }

  const streak = profile?.claim_streak ?? 0

  return (
    <div className="checkin-overlay" onClick={onClose}>
      <div className="checkin-modal" onClick={e => e.stopPropagation()}>
        <button className="checkin-close" onClick={onClose} aria-label="Close">
          <i className="ph-bold ph-x" />
        </button>

        <div className="checkin-flame-icon">
          <i className="ph-bold ph-flame" />
        </div>

        <div className="checkin-title">Daily Check-In</div>
        <div className="checkin-sub">Keep your streak alive</div>

        <div className="checkin-streak-row">
          <div className="checkin-streak-cell">
            <span className="checkin-streak-num">{streak}</span>
            <span className="checkin-streak-label">day streak</span>
          </div>
          <div className="checkin-divider" />
          <div className="checkin-streak-cell">
            <span className="checkin-streak-num">{streak}</span>
            <span className="checkin-streak-label">total days</span>
          </div>
        </div>

        <div className="checkin-reward-badge">
          <i className="ph-bold ph-coin" style={{ fontSize: 13 }} />
          &nbsp;{claimed && todayEarned ? `+${todayEarned} ZXP earned` : '+1 ZXP reward'}
        </div>

        {msg && (
          <div style={{ fontSize: 11, color: 'var(--green)', textAlign: 'center', marginBottom: 4 }}>
            {msg}
          </div>
        )}

        <button
          className="checkin-btn"
          onClick={handleClaim}
          disabled={claimed || claiming}
          style={claimed ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
        >
          <i className={`ph-bold ${claiming ? 'ph-circle-notch' : claimed ? 'ph-check' : 'ph-calendar-check'}`} />
          {claiming ? 'Claiming…' : claimed ? 'Claimed today!' : isConnected ? 'Check In Today' : 'Connect Wallet'}
        </button>

        {!isConnected && (
          <div className="checkin-note">Connect wallet to track your streak</div>
        )}
      </div>
    </div>
  )
}
