'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'

const STEPS = [
  { action: 'connect',   label: 'Connect wallet',           zxp: 3, icon: 'ph-wallet' },
  { action: 'reaction',  label: 'Like a post',              zxp: 1, icon: 'ph-heart' },
  { action: 'comment',   label: 'Leave a comment',          zxp: 2, icon: 'ph-chat' },
  { action: 'watchlist', label: 'Add project to watchlist', zxp: 1, icon: 'ph-eye' },
]
const TOTAL_ZXP = STEPS.reduce((s, t) => s + t.zxp, 0)

// Compact "Earn ZXP" toggle for the feed header (mobile/tablet, where the
// right-rail widget is hidden). The button hides itself once every step is
// done or the onboarding window has passed.
export default function OnboardingButton() {
  const { open: openWallet }     = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const [completed,    setCompleted]    = useState<string[]>([])
  const [withinWindow, setWithinWindow] = useState(true)
  const [loaded,       setLoaded]       = useState(false)
  const [open,         setOpen]         = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  useEffect(() => { if (address) refresh(address) }, [address, refresh])

  useEffect(() => {
    if (!address) return
    const handler = () => refresh(address)
    window.addEventListener('zx:onboarding', handler)
    return () => window.removeEventListener('zx:onboarding', handler)
  }, [address, refresh])

  // Close the popover on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Hide entirely once everything is earned or the window has passed
  if (isConnected && loaded && (!withinWindow || completed.length >= STEPS.length)) return null

  const earned = STEPS.filter(s => completed.includes(s.action)).reduce((n, s) => n + s.zxp, 0)

  return (
    <div className="earn-zxp" ref={ref}>
      <button
        className="earn-zxp-btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title="Earn ZXP"
      >
        <i className="ph-bold ph-coins" />
        Earn ZXP
        <span className="earn-zxp-count">{isConnected ? `${earned}/${TOTAL_ZXP}` : `+${TOTAL_ZXP}`}</span>
        <i className={`ph-bold ${open ? 'ph-caret-up' : 'ph-caret-down'}`} style={{ fontSize: 10 }} />
      </button>

      {open && (
        <div className="earn-zxp-pop">
          <div className="onboarding-widget-head">
            <span className="onboarding-widget-title">Earn ZXP</span>
            <span className="onboarding-widget-earned">
              {isConnected ? `${earned} / ${TOTAL_ZXP} ZXP` : `+${TOTAL_ZXP} ZXP`}
            </span>
          </div>

          <div className="onboarding-progress-bar">
            <div className="onboarding-progress-fill" style={{ width: `${(earned / TOTAL_ZXP) * 100}%` }} />
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
            <button className="onboarding-cta" onClick={() => openWallet()}>
              <i className="ph-bold ph-wallet" />
              Connect to start earning
            </button>
          )}
        </div>
      )}
    </div>
  )
}
