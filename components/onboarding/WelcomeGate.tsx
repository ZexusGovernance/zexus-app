'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'
import SpotlightTour from './SpotlightTour'

// ── First-connect registration gate ─────────────────────────────────────
// The first time a wallet is used on the platform (profile exists but has no
// display_name) this modal asks for a permanent username, then offers the
// interactive tour. Browsing without a wallet is untouched — the gate only
// appears once a wallet is connected.

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export default function WelcomeGate() {
  const router = useRouter()
  const pathname = usePathname()
  const { address } = useAppKitAccount()
  const { profile, refreshProfile } = useProfile()

  const [username, setUsername] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState<string | null>(null)
  const [phase,    setPhase]    = useState<'name' | 'offer'>('name')
  const [tourOn,   setTourOn]   = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const needsName = !!address && !!profile && !profile.display_name && !dismissed
  const show = needsName || phase === 'offer'

  // Settings → "Replay tutorial" re-runs the tour from anywhere
  useEffect(() => {
    const start = () => {
      if (pathname !== '/feed') router.push('/feed')
      setTimeout(() => setTourOn(true), pathname !== '/feed' ? 700 : 0)
    }
    window.addEventListener('zx:start-tour', start)
    return () => window.removeEventListener('zx:start-tour', start)
  }, [pathname, router])

  async function saveUsername() {
    if (saving) return
    const name = username.trim()
    if (!USERNAME_RE.test(name)) {
      setErr('3–20 characters: letters, numbers, underscore only')
      return
    }
    setSaving(true); setErr(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d.error ?? 'Could not save username'); return }
      if (address) await refreshProfile(address)
      setPhase('offer')
    } finally {
      setSaving(false)
    }
  }

  function startTour() {
    setPhase('name'); setDismissed(true)
    if (pathname !== '/feed') {
      router.push('/feed')
      setTimeout(() => setTourOn(true), 700) // let the feed mount its targets
    } else {
      setTourOn(true)
    }
  }

  function skipTour() {
    setPhase('name'); setDismissed(true)
  }

  if (tourOn) return <SpotlightTour onClose={() => setTourOn(false)} />
  if (!show) return null

  return (
    <div className="welcome-overlay">
      <div className="welcome-modal">
        {phase === 'name' || needsName ? (
          <div className="welcome-phase" key="name">
            <div className="welcome-logo">Z</div>
            <div className="welcome-title">Welcome to Zexus</div>
            <div className="welcome-sub">
              Pick a username for the platform. It’s shown instead of your wallet
              address and <strong>can’t be changed later</strong> — choose carefully.
            </div>
            <input
              className="welcome-input"
              placeholder="username"
              value={username}
              maxLength={20}
              autoFocus
              onChange={e => { setUsername(e.target.value); setErr(null) }}
              onKeyDown={e => { if (e.key === 'Enter') saveUsername() }}
            />
            {err && (
              <div className="welcome-err">
                <i className="ph-bold ph-warning-circle" /> {err}
              </div>
            )}
            <div className="welcome-hint">3–20 characters · letters, numbers, underscore</div>
            <button
              className="welcome-btn-primary"
              disabled={saving || !username.trim()}
              onClick={saveUsername}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        ) : (
          <div className="welcome-phase" key="offer">
            <div className="welcome-check"><i className="ph-bold ph-check" /></div>
            <div className="welcome-title">You’re in, @{profile?.display_name}</div>
            <div className="welcome-sub">
              Want a 1-minute tour? We’ll walk you through the feed, verdicts,
              daily ZXP, staking and Predict — right on the live interface.
            </div>
            <button className="welcome-btn-primary" onClick={startTour}>
              <i className="ph-bold ph-play" style={{ fontSize: 12 }} /> Show me around
            </button>
            <button className="welcome-btn-ghost" onClick={skipTour}>
              Skip — I’ll figure it out
            </button>
            <div className="welcome-hint" style={{ marginTop: 2 }}>
              You can replay it anytime from Settings
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
