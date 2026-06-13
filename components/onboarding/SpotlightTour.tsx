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
  // Interactive task: the spotlight hole becomes clickable and the step
  // completes when zx:onboarding fires with this detail key.
  action?: { key: string; hint: string }
}

const STEPS: TourStep[] = [
  // ── Feed ──
  {
    route:   '/feed',
    desktop: '[data-tour="feed-tabs"]',
    mobile:  '[data-tour="feed-tabs"]',
    icon:    'ph-squares-four',
    title:   'The Feed',
    text:    'Every project event lands here - updates, alerts and community verdicts. Use the filters to see only what matters to you.',
  },
  {
    route:   '/feed',
    desktop: '[data-tour="like-btn"]',
    mobile:  '[data-tour="like-btn"]',
    icon:    'ph-heart',
    title:   'Like a post',
    text:    'Posts are how projects talk to you - tap a card to read and discuss. Small actions earn ZXP through the starter tasks. Let’s grab your first one:',
    action:  { key: 'reaction', hint: 'Tap the ♥ heart · +1 ZXP' },
  },
  {
    route:   '/feed',
    desktop: '[data-tour="watch-btn"]',
    mobile:  '[data-tour="watch-btn"]',
    icon:    'ph-star',
    title:   'Your watchlist',
    text:    'The ☆ star tracks a project - its alerts and updates reach you first. Star one now:',
    action:  { key: 'watchlist', hint: 'Tap the ☆ star · +1 ZXP' },
  },
  {
    route:   '/feed',
    desktop: '[data-tour="tab-verdicts"]',
    mobile:  '[data-tour="tab-verdicts"]',
    icon:    'ph-shield-check',
    title:   'Verdicts & voting',
    text:    'Projects make claims - the community votes Confirm or Dispute. Votes move the project’s Trust Score, and correct verdicts earn you ZXP.',
  },
  {
    route:   '/feed',
    desktop: '[data-tour="checkin"]',
    mobile:  '[data-tour="mob-checkin"]',
    icon:    'ph-flame',
    title:   'Daily check-in',
    text:    'Once a day, check in to earn ZXP and build a streak. Your first one is one tap away:',
    action:  { key: 'checkin', hint: 'Check in now · +1 ZXP' },
  },
  // ── Staking (point at the menu first, then travel there) ──
  {
    route:   '/feed',
    desktop: '[data-tour="nav-staking"]',
    mobile:  '[data-tour="mobnav-staking"]',
    icon:    'ph-coin',
    title:   'Staking lives here',
    text:    'This menu item opens Staking ZXP. Hit Next and we’ll go take a look together.',
  },
  {
    route:   '/staking',
    desktop: '[data-tour="staking-stats"]',
    mobile:  '[data-tour="staking-stats"]',
    icon:    'ph-coin',
    title:   'Staking - your numbers',
    text:    'This is the Staking page. Staked = ZXP you’ve locked, APY = the pool rate it grows at, Rewards = what it has already earned for you.',
  },
  {
    route:   '/staking',
    desktop: '[data-tour="stake-input"]',
    mobile:  '[data-tour="stake-input"]',
    icon:    'ph-arrow-circle-down',
    title:   'Stake your first ZXP',
    text:    'You’ve already earned ZXP during this tour. Staking is off-chain - no gas, instant, short cooldown to unstake - and the longer you stake, the bigger your vote weight. Try it:',
    action:  { key: 'stake', hint: 'Type 1 (or MAX) → press Stake' },
  },
  {
    route:   '/staking',
    desktop: '[data-tour="staking-tabs"]',
    mobile:  '[data-tour="staking-tabs"]',
    icon:    'ph-clock-counter-clockwise',
    title:   'History & Epoch',
    text:    'History lists every ZXP transaction. Epoch is the 6-month governance cycle - it sets action prices like the Emergency Call cost, and its Community Burn Pool raises everyone’s APY.',
  },
  // ── Projects ──
  {
    route:   '/staking',
    desktop: '[data-tour="nav-projects"]',
    mobile:  '[data-tour="mobnav-projects"]',
    icon:    'ph-buildings',
    title:   'Next: Projects',
    text:    'The project registry is right here in the menu. Let’s open it.',
  },
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
    route:   '/projects',
    desktop: '[data-tour="nav-predict"]',
    mobile:  '[data-tour="mobnav-predict"]',
    icon:    'ph-trend-up',
    title:   'Last stop: Predict',
    text:    'Prediction markets live here. One more click.',
  },
  {
    route:   '/predict',
    desktop: '.pcard',
    mobile:  '.pcard',
    icon:    'ph-trend-up',
    title:   'Predict',
    text:    'Bet ZXP on project outcomes - call it right and you take a share of the pool. That’s the tour - welcome aboard!',
  },
]

const PAD = 6 // px of breathing room around the highlighted element

interface Rect { top: number; left: number; width: number; height: number }

export default function SpotlightTour({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [missing, setMissing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [done, setDone] = useState(false)          // current step's task completed
  const [modalHidden, setModalHidden] = useState(false) // an app modal (check-in) is open
  const [tipH, setTipH] = useState(190)
  const [closing, setClosing] = useState(false)
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

  // Close the tour with a gentle fade-out instead of an instant unmount, so the
  // card eases away rather than snapping shut.
  const endTour = useCallback(() => {
    setClosing(true)
    window.setTimeout(onClose, 460)
  }, [onClose])

  // Acquire the target for the current step. If the step lives on another
  // page, navigate there first (the tour layer hides and fades back in once
  // the new target is found). Poll generously — pages compile and fetch data.
  useEffect(() => {
    let cancelled = false
    let tries = 0
    setMissing(false)

    const navigated = window.location.pathname !== STEPS[step].route

    // After a page change wait generously (compile + data fetch). Interactive
    // task steps target async content (feed posts, stake input) that renders
    // late on slower phones, so give them the same long window even on the same
    // page — otherwise the activity gets skipped and never appears on mobile.
    // Plain info steps whose target is simply absent in this layout skip fast.
    const maxTries = navigated ? 80 : STEPS[step].action ? 60 : 28
    const find = () => {
      if (cancelled) return
      const onRoute = window.location.pathname === STEPS[step].route
      const el = onRoute ? document.querySelector(selectorFor(STEPS[step])) : null
      if (el) {
        targetRef.current = el
        // Instant (not smooth) scroll: every step centres its target, so after
        // the jump the spotlight glides ONCE from the previous centred spot to
        // the new one via its CSS transition. A smooth scroll instead made the
        // overlay chase the moving target frame-by-frame — the laggy, stuttery
        // feel between e.g. like → watchlist and within Staking.
        el.scrollIntoView({ block: 'center', behavior: 'auto' })
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { if (!cancelled) measure() })
        })
      } else if (++tries < maxTries) {
        setTimeout(find, 150)
      } else {
        setMissing(true) // target never appeared → auto-advance
      }
    }

    if (navigated) {
      // Ease the layer out first, then travel — no abrupt jump cuts.
      setLeaving(true)
      setTimeout(() => {
        if (cancelled) return
        setLeaving(false)
        targetRef.current = null
        setRect(null)
        router.push(STEPS[step].route)
        find()
      }, 380)
    } else {
      find()
    }
    return () => { cancelled = true }
  }, [step, measure, router])

  // Skip steps whose target doesn't exist in this layout. Reset the flag in
  // the same batch — otherwise this effect re-fires on the next step while
  // `missing` is still true and skips TWO steps at once.
  useEffect(() => {
    if (!missing) return
    setMissing(false)
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else endTour()
  }, [missing, step, endTour])

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
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') endTour() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [endTour])

  // Interactive tasks: complete when the matching zx:onboarding detail fires
  useEffect(() => {
    setDone(false)
    const act = STEPS[step].action
    if (!act) return
    const h = (e: Event) => {
      if ((e as CustomEvent).detail === act.key) setDone(true)
    }
    window.addEventListener('zx:onboarding', h)
    return () => window.removeEventListener('zx:onboarding', h)
  }, [step])

  // Task done → celebrate briefly, then move on
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => {
      if (step < STEPS.length - 1) setStep(s => s + 1)
      else endTour()
    }, 1300)
    return () => clearTimeout(t)
  }, [done, step, endTour])

  // The check-in modal opens on top of the page but UNDER the tour layer —
  // hide the tour while any cooperating modal announces itself.
  useEffect(() => {
    const open = () => setModalHidden(true)
    const close = () => { setModalHidden(false); measure() }
    window.addEventListener('zx:modal-open', open)
    window.addEventListener('zx:modal-closed', close)
    return () => {
      window.removeEventListener('zx:modal-open', open)
      window.removeEventListener('zx:modal-closed', close)
    }
  }, [measure])

  // Track the tooltip's real height so the card glides (top is always
  // animatable) instead of flipping between top/bottom anchoring.
  useEffect(() => {
    const h = tipRef.current?.offsetHeight
    if (h) setTipH(h)
  }, [step, rect])

  if (!rect) return null

  const s = STEPS[step]
  const interactive = !!s.action && !done
  const vw = window.innerWidth
  const vh = window.innerHeight
  // On phones the fixed top bar (56px + notch) and the floating bottom nav
  // (~76px) overlay the page. The tooltip carries the interactive task chip,
  // so keep it inside the visible band — otherwise the activity hides behind a
  // bar and looks like it was never there.
  const mob = isMobile()
  const topInset = mob ? 70 : 12
  const bottomInset = mob ? 98 : 12
  const tipW = Math.min(330, vw - 24)
  const below = rect.top + rect.height + 12
  const placeBelow = below + tipH + 12 < vh - bottomInset // room under the target?
  let tipTop = placeBelow ? below : rect.top - tipH - 12
  tipTop = Math.min(
    Math.max(tipTop, topInset),
    Math.max(topInset, vh - bottomInset - tipH),
  )
  const tipLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - tipW / 2, vw - tipW - 12))

  return (
    <div className={`tour-root${leaving ? ' tour-leaving' : ''}${modalHidden ? ' tour-hidden' : ''}${closing ? ' tour-closing' : ''}`}>
      {/* Click-blocker. On task steps it splits into four strips AROUND the
          spotlight hole so the highlighted control itself stays clickable. */}
      {interactive ? (
        <>
          <div className="tour-block" style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top), bottom: 'auto' }} />
          <div className="tour-block" style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} />
          <div className="tour-block" style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height, right: 'auto', bottom: 'auto' }} />
          <div className="tour-block" style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height, bottom: 'auto' }} />
        </>
      ) : (
        <div className="tour-block" onClick={e => e.stopPropagation()} />
      )}

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
          <button className="tour-skip" onClick={endTour}>Skip</button>
        </div>
        <div className="tour-tip-text">{s.text}</div>
        {s.action && (
          <div className={`tour-task${done ? ' done' : ''}`}>
            <i className={`ph-bold ${done ? 'ph-check-circle' : 'ph-hand-tap'}`} />
            {done ? 'Nice - task complete!' : s.action.hint}
          </div>
        )}
        <div className="tour-tip-foot">
          <div className="tour-progress">
            <div className="tour-progress-track">
              <div
                className="tour-progress-fill"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <span className="tour-progress-count">{step + 1}/{STEPS.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {step > 0 && (
              <button className="tour-btn" onClick={() => setStep(s2 => s2 - 1)}>Back</button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="tour-btn tour-btn-primary" onClick={() => setStep(s2 => s2 + 1)}>
                {interactive ? 'Skip' : 'Next'} <i className="ph-bold ph-arrow-right" style={{ fontSize: 11 }} />
              </button>
            ) : (
              <button className="tour-btn tour-btn-primary" onClick={endTour}>
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
