'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Spotlight tour ──────────────────────────────────────────────────────
// Dims the page and cuts a "hole" over a real UI element (box-shadow trick),
// with an animated highlight ring and an explainer tooltip. The tour walks
// across PAGES: each step declares its route and the engine navigates there
// before spotlighting. Steps declare separate desktop / mobile selectors
// where the layouts differ; steps whose target never appears are skipped.

interface TourStep {
  route: string            // page the step lives on
  desktop: string          // CSS selector on desktop/tablet
  mobile: string           // CSS selector on phones (≤720px)
  title: string
  text: string
  icon: string             // phosphor icon class
}

const STEPS: TourStep[] = [
  // ── Feed ──
  {
    route:   '/feed',
    desktop: '[data-tour="feed-tabs"]',
    mobile:  '[data-tour="feed-tabs"]',
    icon:    'ph-squares-four',
    title:   'The Feed',
    text:    'Every project event lands here — updates, alerts and community verdicts. Use the filters to see only what matters to you.',
  },
  {
    route:   '/feed',
    desktop: '.feed-card',
    mobile:  '.feed-card',
    icon:    'ph-newspaper',
    title:   'Project posts',
    text:    'Tap a card to read the full post, like it and join the discussion. The ☆ star in the header adds the project to your watchlist — you’ll get alerts about it.',
  },
  {
    route:   '/feed',
    desktop: '[data-tour="tab-verdicts"]',
    mobile:  '[data-tour="tab-verdicts"]',
    icon:    'ph-shield-check',
    title:   'Verdicts & voting',
    text:    'Projects make claims — the community votes Confirm or Dispute. Votes move the project’s Trust Score, and correct verdicts earn you ZXP.',
  },
  {
    route:   '/feed',
    desktop: '[data-tour="checkin"]',
    mobile:  '[data-tour="mob-checkin"]',
    icon:    'ph-flame',
    title:   'Daily check-in',
    text:    'Check in once a day to earn ZXP and build a streak. ZXP is the platform currency — you also earn it from likes, comments, verdicts and referrals.',
  },
  // ── Staking (the tour navigates there) ──
  {
    route:   '/staking',
    desktop: '[data-tour="staking-stats"]',
    mobile:  '[data-tour="staking-stats"]',
    icon:    'ph-coin',
    title:   'Staking — your numbers',
    text:    'This is the Staking page. Staked = ZXP you’ve locked, APY = the pool rate it grows at, Rewards = what it has already earned for you.',
  },
  {
    route:   '/staking',
    desktop: '[data-tour="stake-input"]',
    mobile:  '[data-tour="stake-input"]',
    icon:    'ph-arrow-circle-down',
    title:   'How to stake',
    text:    'Type an amount (or hit MAX) and press Stake — off-chain, no gas, instant. Unstaking has a short cooldown. The longer you stay staked, the bigger your vote weight multiplier.',
  },
  {
    route:   '/staking',
    desktop: '[data-tour="staking-tabs"]',
    mobile:  '[data-tour="staking-tabs"]',
    icon:    'ph-clock-counter-clockwise',
    title:   'History & Epoch',
    text:    'History lists every ZXP transaction. Epoch shows the 6-month governance cycle and the Community Burn Pool — burning ZXP together raises everyone’s APY.',
  },
  // ── Projects ──
  {
    route:   '/projects',
    desktop: '.proj-list-card',
    mobile:  '.proj-list-card',
    icon:    'ph-buildings',
    title:   'Projects & Trust Score',
    text:    'Every project has a community-driven Trust Score built from verdicts. Open a project to see its profile, milestones and post history.',
  },
  // ── Predict ──
  {
    route:   '/predict',
    desktop: '.pcard',
    mobile:  '.pcard',
    icon:    'ph-trend-up',
    title:   'Predict',
    text:    'Bet ZXP on project outcomes — call it right and you take a share of the pool. That’s the tour — welcome aboard!',
  },
]

const PAD = 6 // px of breathing room around the highlighted element

interface Rect { top: number; left: number; width: number; height: number }

export default function SpotlightTour({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [missing, setMissing] = useState(false)
  const [tipH, setTipH] = useState(190)
  const targetRef = useRef<Element | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const isMobile = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches

  const selectorFor = (s: TourStep) => (isMobile() ? s.mobile : s.desktop)

  const measure = useCallback(() => {
    const el = targetRef.current
    if (!el || !document.contains(el)) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [])

  // Acquire the target for the current step. If the step lives on another
  // page, navigate there first (the tour layer hides and fades back in once
  // the new target is found). Poll generously — pages compile and fetch data.
  useEffect(() => {
    let cancelled = false
    let tries = 0
    setMissing(false)

    const navigated = window.location.pathname !== STEPS[step].route
    if (navigated) {
      targetRef.current = null
      setRect(null) // hide the layer while travelling to the next page
      router.push(STEPS[step].route)
    }

    // After a page change wait generously (compile + data fetch); on the same
    // page a missing target means it just isn't rendered — skip fast.
    const maxTries = navigated ? 60 : 15
    const find = () => {
      if (cancelled) return
      const onRoute = window.location.pathname === STEPS[step].route
      const el = onRoute ? document.querySelector(selectorFor(STEPS[step])) : null
      if (el) {
        targetRef.current = el
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTimeout(() => { if (!cancelled) measure() }, 350)
      } else if (++tries < maxTries) {
        setTimeout(find, 150)
      } else {
        setMissing(true) // target never appeared → auto-advance
      }
    }
    find()
    return () => { cancelled = true }
  }, [step, measure, router])

  // Skip steps whose target doesn't exist in this layout
  useEffect(() => {
    if (!missing) return
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else onClose()
  }, [missing, step, onClose])

  // Track layout shifts while the tour is open
  useEffect(() => {
    const id = setInterval(measure, 250)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  // Esc closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // Track the tooltip's real height so the card glides (top is always
  // animatable) instead of flipping between top/bottom anchoring.
  useEffect(() => {
    const h = tipRef.current?.offsetHeight
    if (h) setTipH(h)
  }, [step, rect])

  if (!rect) return null

  const s = STEPS[step]
  const vw = window.innerWidth
  const vh = window.innerHeight
  const tipW = Math.min(330, vw - 24)
  const below = rect.top + rect.height + 12
  const placeBelow = below + tipH + 12 < vh // enough room under the target?
  const tipTop = placeBelow ? below : Math.max(12, rect.top - tipH - 12)
  const tipLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - tipW / 2, vw - tipW - 12))

  return (
    <div className="tour-root">
      {/* click-blocker so the page underneath can't be interacted with */}
      <div className="tour-block" onClick={e => e.stopPropagation()} />

      {/* spotlight hole + pulsing ring */}
      <div
        className="tour-highlight"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />

      {/* explainer card — persists across steps and glides to its new spot;
          only the inner content cross-fades (key) */}
      <div
        ref={tipRef}
        className="tour-tooltip"
        style={{ top: tipTop, left: tipLeft, width: tipW }}
      >
        <div key={step} className="tour-tip-content">
        <div className="tour-tip-head">
          <span className="tour-tip-icon"><i className={`ph-bold ${s.icon}`} /></span>
          <span className="tour-tip-title">{s.title}</span>
          <button className="tour-skip" onClick={onClose}>Skip</button>
        </div>
        <div className="tour-tip-text">{s.text}</div>
        <div className="tour-tip-foot">
          <div className="tour-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`tour-dot${i === step ? ' on' : i < step ? ' done' : ''}`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {step > 0 && (
              <button className="tour-btn" onClick={() => setStep(s2 => s2 - 1)}>Back</button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="tour-btn tour-btn-primary" onClick={() => setStep(s2 => s2 + 1)}>
                Next <i className="ph-bold ph-arrow-right" style={{ fontSize: 11 }} />
              </button>
            ) : (
              <button className="tour-btn tour-btn-primary" onClick={onClose}>
                <i className="ph-bold ph-check" style={{ fontSize: 11 }} /> Done
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
