'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'

const STEPS = [
  { action: 'connect',   label: 'Connect wallet',          zxp: 3, icon: 'ph-wallet' },
  { action: 'reaction',  label: 'Like a post',             zxp: 1, icon: 'ph-heart' },
  { action: 'comment',   label: 'Leave a comment',         zxp: 2, icon: 'ph-chat' },
  { action: 'watchlist', label: 'Add project to watchlist', zxp: 1, icon: 'ph-eye' },
]
const TOTAL_ZXP = STEPS.reduce((s, t) => s + t.zxp, 0)

export default function OnboardingWidget() {
  const { open }                        = useAppKit()
  const { address, isConnected }        = useAppKitAccount()
  const [completed,    setCompleted]    = useState<string[]>([])
  const [withinWindow, setWithinWindow] = useState(true)
  const [loaded,       setLoaded]       = useState(false)

  const refresh = useCallback((addr: string) => {
    fetch(`/api/zxp/onboarding?wallet=${encodeURIComponent(addr)}`)
      .then(r => r.json())
      .then(({ completed: c, within_window: w }) => {
        setCompleted(c ?? [])
        setWithinWindow(w ?? true)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!address) return
    refresh(address)
  }, [address, refresh])

  useEffect(() => {
    if (!address) return
    const handler = () => refresh(address)
    window.addEventListener('zx:onboarding', handler)
    return () => window.removeEventListener('zx:onboarding', handler)
  }, [address, refresh])

  if (isConnected && loaded && !withinWindow) return null
  if (isConnected && loaded && completed.length >= STEPS.length) return null

  const earned = STEPS.filter(s => completed.includes(s.action)).reduce((n, s) => n + s.zxp, 0)

  return (
    <div className="onboarding-widget">
      <div className="onboarding-widget-head">
        <span className="onboarding-widget-title">Earn ZXP</span>
        {isConnected && (
          <span className="onboarding-widget-earned">{earned} / {TOTAL_ZXP} ZXP</span>
        )}
        {!isConnected && (
          <span className="onboarding-widget-earned">+{TOTAL_ZXP} ZXP</span>
        )}
      </div>

      <div className="onboarding-progress-bar">
        <div
          className="onboarding-progress-fill"
          style={{ width: `${TOTAL_ZXP > 0 ? (earned / TOTAL_ZXP) * 100 : 0}%` }}
        />
      </div>

      <div className="onboarding-steps">
        {STEPS.map(step => {
          const done = completed.includes(step.action)
          return (
            <div key={step.action} className={`onboarding-step${done ? ' done' : ''}`}>
              <div className="onboarding-step-check">
                <i className={`ph-bold ${done ? 'ph-check' : step.icon}`} />
              </div>
              <span className="onboarding-step-label">{step.label}</span>
              <span className="onboarding-step-zxp">+{step.zxp} ZXP</span>
            </div>
          )
        })}
      </div>

      {!isConnected && (
        <button className="onboarding-cta" onClick={() => open()}>
          <i className="ph-bold ph-wallet" />
          Connect to start earning
        </button>
      )}
    </div>
  )
}
