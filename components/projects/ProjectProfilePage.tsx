'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppKitAccount } from '@reown/appkit/react'
import Nav from '@/components/nav/Nav'
import { PROJECTS_FULL } from '@/lib/projects'
import type { ProjectFull, TimelineEvent } from '@/lib/projects'
import type { FeedPost, PostType } from '@/lib/feedData'
import type { DbPost } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import CreatePostModal from '@/components/feed/CreatePostModal'
import PostCard from '@/components/feed/PostCard'
import PostDetailModal from '@/components/feed/PostDetailModal'

type Tab = 'overview' | 'timeline' | 'roadmap' | 'votes' | 'holders' | 'posts' | 'analytics' | 'settings'

interface Milestone {
  id:          string
  project_id:  string
  year:        number
  quarter:     number
  title:       string
  description: string | null
  status:      'completed' | 'in_progress' | 'upcoming' | 'pending_confirmation' | 'disputed' | 'missed'
  sort_order:  number
}

interface SocialLinks {
  website_url:    string | null
  whitepaper_url: string | null
  github_url:     string | null
  twitter_url:    string | null
  discord_url:    string | null
  avatar_url:     string | null
}

interface DbProjectData {
  name:        string
  slug:        string
  category:    string | null
  description: string | null
  trust_score: number
  is_verified: boolean
  created_at:  string
}

function buildProjectFull(db: DbProjectData): ProjectFull {
  const AV = ['av-blue', 'av-teal', 'av-purple', 'av-red', 'av-gold']
  const hash = db.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const score = db.trust_score
  return {
    id:          db.slug,
    name:        db.name,
    av:          AV[hash % AV.length],
    letter:      db.name.charAt(0).toUpperCase(),
    cat:         `${db.category ?? 'Protocol'} · Base Mainnet`,
    sub:         `${db.category ?? 'Protocol'} · Base Mainnet`,
    chain:       'Base Mainnet',
    tags: [
      ...(db.is_verified ? [{ label: 'Verified', variant: 'verified' }] : []),
      ...(db.category    ? [{ label: db.category }]                     : []),
    ],
    score,
    scoreClass:  score >= 70 ? 'hi' : score >= 45 ? 'mi' : 'lo',
    trend:       '—',
    trendClass:  'plt-na',
    trustLabel:  score >= 70 ? 'Excellent' : score >= 45 ? 'Moderate' : 'Low',
    holders:     '—',
    verdicts:    0,
    activeSince: new Date(db.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    overview:    db.description ?? 'No description provided yet.',
    milestones:      [],
    votes:           [],
    topHolders:      [],
    timelineEvents:  {},
    verifiers:       [],
  }
}

const AV_CLASSES = ['av-blue', 'av-teal', 'av-purple', 'av-red', 'av-gold']
function projectAv(name: string): string {
  const proj = PROJECTS_FULL.find(p => p.name === name)
  if (proj) return proj.av
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AV_CLASSES[hash % AV_CLASSES.length]
}

function dbToFeedPost(row: DbPost): FeedPost {
  return {
    id:          row.id,
    type:        row.post_type as PostType,
    project:     row.project_name,
    projectSlug: row.project_slug,
    projectId:   row.project_id,
    av:          projectAv(row.project_name),
    letter:      row.project_name[0]?.toUpperCase() ?? '?',
    avatarUrl:   row.project_avatar_url ?? undefined,
    sub:         row.project_category ?? 'Protocol',
    title:       row.title ?? '',
    text:        row.content,
    detailText:  row.content,
    time:        new Date(row.created_at).toLocaleString('en-US', {
      hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric',
    }),
    createdAt:   row.created_at,
    comments:    [],
    images:      row.image_url ? [row.image_url] : undefined,
    likeCount:   row.likes_count,
    viewCount:   row.views_count ?? 0,
    commentsCount: row.comments_count ?? 0,
    ...(row.trust_score_change != null && row.trust_score_change !== 0
      ? { trustScoreChange: row.trust_score_change } : {}),
  }
}

const SCORE_BREAKDOWN = [
  { label: 'Social presence',   max: 25, desc: 'Twitter followers, Discord/TG members, GitHub activity' },
  { label: 'Product',           max: 25, desc: 'Stage (testnet/mainnet), whitepaper, security audit' },
  { label: 'On-chain',          max: 20, desc: 'Verified wallet holders, TVL' },
  { label: 'Team',              max: 15, desc: 'Doxxed team, known investors' },
  { label: 'Track record',      max: 10, desc: 'Community vote outcomes (verdicts)' },
  { label: 'Bonus',             max: 10, desc: 'Early listing, consistent updates' },
]

function TrustScore({ score, label, trend, trendClass }: { score: number | null; label: string; trend: string; trendClass: string }) {
  const [open, setOpen] = useState(false)
  const pct = score ?? 0
  return (
    <div className="panel">
      <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Trust Score</span>
        <button
          onClick={() => setOpen(o => !o)}
          title="How is Trust Score calculated?"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            color: open ? 'var(--text)' : 'var(--muted2)', fontSize: 13, lineHeight: 1,
            borderRadius: 4, transition: 'color 0.15s',
          }}
        >
          <i className="ph-bold ph-info" />
        </button>
      </div>

      {open && (
        <div className="ui-fade-in" style={{
          background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)',
          borderRadius: 8, padding: '10px 12px', marginBottom: 10,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 8 }}>
            How it&apos;s calculated
          </div>
          {SCORE_BREAKDOWN.map(b => (
            <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{b.label}</div>
                <div style={{ fontSize: 10, color: 'var(--muted2)', lineHeight: 1.4 }}>{b.desc}</div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, paddingTop: 2 }}>up to {b.max}</span>
            </div>
          ))}
          <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', marginTop: 6, paddingTop: 8, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
            <span style={{ color: '#6fcf83', fontWeight: 600 }}>70–100</span> Excellent ·{' '}
            <span style={{ color: '#e6c84a', fontWeight: 600 }}>45–69</span> Moderate ·{' '}
            <span style={{ color: '#e07070', fontWeight: 600 }}>0–44</span> Low
          </div>
        </div>
      )}

      <div className="ts-big">{score ?? '—'}</div>
      <div className="ts-lbl">{label}</div>
      <div className="ts-bar-wrap">
        <div className="ts-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ts-hint"><span>0</span><span>100</span></div>
      <div style={{ marginTop: 8, fontSize: 11, color: trendClass === 'plt-up' ? 'var(--green)' : trendClass === 'plt-down' ? 'var(--red)' : 'var(--muted)' }}>
        {trendClass === 'plt-up' && <i className="ph-bold ph-trend-up" style={{ marginRight: 4 }} />}
        {trendClass === 'plt-down' && <i className="ph-bold ph-trend-down" style={{ marginRight: 4 }} />}
        {trend} this month
      </div>
    </div>
  )
}

function OverviewTab({ project, verdictCount, holderCount }: { project: ProjectFull; verdictCount: number; holderCount: number | null }) {
  const [showTrustBreakdown, setShowTrustBreakdown] = useState(false)
  return (
    <div>
      <div className="trust-timeline-card">
        <div className="concept-head">
          <div>
            <div className="concept-title">About</div>
            <div className="concept-sub">{project.overview}</div>
          </div>
        </div>
      </div>
      <div className="roadmap-promises" style={{ marginTop: 12 }}>
        <div className="concept-head">
          <div>
            <div className="concept-title">Quick stats</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '4px 0' }}>
          {[
            { k: 'Chain', v: project.chain },
            { k: 'Active since', v: project.activeSince },
            ...(holderCount !== null && holderCount > 0 ? [{ k: 'Verified holders', v: String(holderCount) }] : []),
            { k: 'Community verdicts', v: String(verdictCount) },
            { k: 'Category', v: project.cat.split(' · ')[0] },
          ].map(({ k, v }) => (
            <div key={k} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{v}</div>
            </div>
          ))}
          {/* Trust Score — tappable, expands breakdown */}
          <div
            onClick={() => setShowTrustBreakdown(o => !o)}
            style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', gridColumn: '1 / -1' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 4 }}>Trust Score</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
                  {project.score !== null ? String(project.score) : 'Unscored'}
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>{project.trustLabel}</span>
                </div>
              </div>
              <i className={`ph-bold ${showTrustBreakdown ? 'ph-caret-up' : 'ph-info'}`} style={{ fontSize: 14, color: 'var(--muted2)', flexShrink: 0 }} />
            </div>
            {showTrustBreakdown && (
              <div className="ui-fade-in" style={{ marginTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                {SCORE_BREAKDOWN.map(b => (
                  <div key={b.label} className="ts-breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{b.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted2)', lineHeight: 1.4 }}>{b.desc}</div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, paddingTop: 2 }}>up to {b.max}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
                  <span style={{ color: '#6fcf83', fontWeight: 600 }}>70–100</span> Excellent ·{' '}
                  <span style={{ color: '#e6c84a', fontWeight: 600 }}>45–69</span> Moderate ·{' '}
                  <span style={{ color: '#e07070', fontWeight: 600 }}>0–44</span> Low
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TrustEventProp {
  id: string
  delta: number
  reason: string | null
  score_after: number
  created_at: string
}

function TimelineTab({ history }: { history: TrustEventProp[] }) {
  // Build day-of-month → first event that day (current month)
  const now = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth()

  const dayEventMap = new Map<number, TrustEventProp>()
  for (const ev of [...history].reverse()) {
    const d = new Date(ev.created_at)
    if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
      dayEventMap.set(d.getDate(), ev)
    }
  }

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const monthName   = now.toLocaleString('en-US', { month: 'long' })

  const firstDayWithEvent = dayEventMap.size > 0 ? Math.max(...dayEventMap.keys()) : null
  const [selectedDay, setSelectedDay] = useState<number | null>(firstDayWithEvent)

  const selectedEvent = selectedDay !== null ? dayEventMap.get(selectedDay) ?? null : null

  const last5 = history.slice(0, 5)

  return (
    <div className="trust-timeline-card" id="trust-timeline">
      <div className="concept-head">
        <div>
          <div className="concept-title">Trust Timeline</div>
          <div className="concept-sub">Every promise, missed deadline, update, and community verdict becomes visible over time.</div>
        </div>
        <div className="timeline-legend">
          <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(83,201,146,0.62)' }} />Positive</span>
          <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(238,121,121,0.62)' }} />Negative</span>
          <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(225,184,94,0.68)' }} />Neutral</span>
        </div>
      </div>
      <div className="timeline-grid">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const ev  = dayEventMap.get(day)
          let dotClass = 'tl-none'
          if (ev) {
            dotClass = ev.delta > 0 ? 'tl-verified' : ev.delta < 0 ? 'tl-risk' : 'tl-voting'
          }
          return (
            <button
              key={day}
              className={`timeline-day ${dotClass}${selectedDay === day ? ' active' : ''}`}
              type="button"
              aria-label={`${monthName} ${String(day).padStart(2, '0')}`}
              onClick={() => setSelectedDay(day)}
            />
          )
        })}
      </div>
      {selectedDay !== null && (
        <div className="timeline-detail">
          <div>
            <div className="timeline-date">
              {monthName} {String(selectedDay).padStart(2, '0')}, {currentYear}
            </div>
            {selectedEvent ? (
              <>
                <div className="timeline-event-title">
                  {selectedEvent.reason ?? 'Trust score update'}
                </div>
                <div className="timeline-meta">
                  <span style={{ color: selectedEvent.delta > 0 ? 'var(--green)' : selectedEvent.delta < 0 ? 'var(--red)' : 'var(--muted)' }}>
                    {selectedEvent.delta > 0 ? `+${selectedEvent.delta}` : `${selectedEvent.delta}`} pts
                  </span>
                  {' · '}Score after: {selectedEvent.score_after}
                </div>
              </>
            ) : (
              <div className="timeline-event-title" style={{ color: 'var(--muted2)' }}>No activity</div>
            )}
          </div>
          <div />
        </div>
      )}

      {/* Last 5 events log */}
      {last5.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 8 }}>
            Recent events
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {last5.map(ev => {
              const d = new Date(ev.created_at)
              const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, gap: 8 }}>
                  <span style={{ color: 'var(--muted2)', flexShrink: 0 }}>{dateStr}</span>
                  <span style={{ color: 'var(--muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.reason ?? 'Trust score update'}
                  </span>
                  <span style={{
                    fontWeight: 600, flexShrink: 0,
                    color: ev.delta > 0 ? 'var(--green)' : ev.delta < 0 ? 'var(--red)' : 'var(--muted)',
                  }}>
                    {ev.delta > 0 ? `+${ev.delta}` : `${ev.delta}`} pts
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 12, padding: '16px 0' }}>
          No trust score events recorded yet.
        </div>
      )}
    </div>
  )
}

function RoadmapTab({ milestones, loading }: { milestones: Milestone[]; loading: boolean }) {
  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 12 }}>Loading roadmap…</div>
  }

  if (milestones.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '52px 20px', color: 'var(--muted2)', textAlign: 'center' }}>
        <i className="ph-bold ph-map-trifold" style={{ fontSize: 32, opacity: 0.25 }} />
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>Roadmap not provided yet</div>
        <div style={{ fontSize: 11, maxWidth: 260, lineHeight: 1.6 }}>The project team hasn't added their roadmap yet.</div>
      </div>
    )
  }

  // Group by year then quarter
  const grouped = new Map<number, Map<number, Milestone[]>>()
  for (const m of milestones) {
    if (!grouped.has(m.year)) grouped.set(m.year, new Map())
    const byQ = grouped.get(m.year)!
    if (!byQ.has(m.quarter)) byQ.set(m.quarter, [])
    byQ.get(m.quarter)!.push(m)
  }
  const years = Array.from(grouped.keys()).sort((a, b) => a - b)

  const STATUS_DOT: Record<string, { bg: string; border: string; glow?: string }> = {
    completed:            { bg: '#53c992', border: '#53c992', glow: 'rgba(83,201,146,0.4)' },
    in_progress:          { bg: '#6f9be5', border: '#6f9be5', glow: 'rgba(111,155,229,0.4)' },
    upcoming:             { bg: 'transparent', border: 'rgba(255,255,255,0.2)' },
    pending_confirmation: { bg: '#c9a55a', border: '#c9a55a', glow: 'rgba(201,165,90,0.4)' },
    disputed:             { bg: '#e07070', border: '#e07070', glow: 'rgba(224,112,112,0.35)' },
    missed:               { bg: 'rgba(224,112,112,0.25)', border: '#e07070' },
  }
  const STATUS_LABEL: Record<string, string> = {
    completed:            'Done',
    in_progress:          'In progress',
    upcoming:             'Planned',
    pending_confirmation: 'Awaiting vote',
    disputed:             'Rejected',
    missed:               'Missed',
  }
  const STATUS_COLOR: Record<string, string> = {
    completed:            'var(--green)',
    in_progress:          '#6f9be5',
    upcoming:             'var(--muted2)',
    pending_confirmation: '#c9a55a',
    disputed:             'var(--red)',
    missed:               'var(--red)',
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      {years.map((year, yi) => {
        const quarters = grouped.get(year)!
        const qList = Array.from(quarters.keys()).sort((a, b) => a - b)
        return (
          <div key={year}>
            {/* Year label */}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 16, marginTop: yi > 0 ? 32 : 0, paddingLeft: 2 }}>
              {year}
            </div>

            {qList.map((q, qi) => {
              const items = quarters.get(q)!
              const isLast = yi === years.length - 1 && qi === qList.length - 1
              return (
                <div key={q} style={{ display: 'flex', gap: 0, position: 'relative' }}>
                  {/* Left: quarter label + line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', letterSpacing: '0.5px', height: 22, display: 'flex', alignItems: 'center' }}>
                      Q{q}
                    </div>
                    {!isLast && (
                      <div style={{ flex: 1, width: 1, background: 'rgba(255,255,255,0.07)', minHeight: 24 }} />
                    )}
                  </div>

                  {/* Items */}
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20 }}>
                    {items.map((m, mi) => {
                      const dot = STATUS_DOT[m.status]
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: mi < items.length - 1 ? 10 : 0 }}>
                          {/* Dot */}
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                            background: dot.bg, border: `1.5px solid ${dot.border}`,
                            boxShadow: dot.glow ? `0 0 6px ${dot.glow}` : 'none',
                          }} />
                          {/* Content */}
                          <div style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 9, padding: '9px 13px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.35 }}>{m.title}</div>
                              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: STATUS_COLOR[m.status], flexShrink: 0 }}>
                                {m.status === 'completed'            && <i className="ph-bold ph-check"         style={{ marginRight: 3 }} />}
                                {m.status === 'in_progress'          && <i className="ph-bold ph-circle-notch"  style={{ marginRight: 3 }} />}
                                {m.status === 'pending_confirmation' && <i className="ph-bold ph-hourglass"     style={{ marginRight: 3 }} />}
                                {m.status === 'disputed'             && <i className="ph-bold ph-x-circle"      style={{ marginRight: 3 }} />}
                                {m.status === 'missed'               && <i className="ph-bold ph-clock-countdown" style={{ marginRight: 3 }} />}
                                {STATUS_LABEL[m.status]}
                              </span>
                            </div>
                            {m.description && (
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.55 }}>{m.description}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

interface VotingPostProps {
  id: string
  title: string | null
  created_at: string
  voting_deadline: string | null
  voting_finalized: boolean
  trust_score_change: number | null
  confirm_count: number
  dispute_count: number
  total: number
}

function VotesTab({ posts, loading }: { posts: VotingPostProps[]; loading: boolean }) {
  function statusLabel(p: VotingPostProps): { text: string; color: string } {
    if (!p.voting_finalized) {
      if (p.voting_deadline) {
        const msLeft = new Date(p.voting_deadline).getTime() - Date.now()
        if (msLeft > 0) {
          const daysLeft = Math.ceil(msLeft / 86_400_000)
          return { text: `Open · ${daysLeft}d left`, color: 'var(--muted2)' }
        }
      }
      return { text: 'Open', color: 'var(--muted2)' }
    }
    if (p.trust_score_change === null || p.total < 1) {
      return { text: 'Not enough votes', color: 'var(--muted2)' }
    }
    if (p.trust_score_change > 0) return { text: 'Confirmed ✓', color: 'var(--green)' }
    return { text: 'Rejected ✗', color: 'var(--red)' }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 12 }}>
        Loading votes…
      </div>
    )
  }

  return (
    <div className="roadmap-promises">
      <div className="concept-head">
        <div>
          <div className="concept-title">Community Votes</div>
          <div className="concept-sub">On-chain proposals voted on by the community.</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {posts.map(p => {
          const confirmPct = p.total > 0 ? Math.round((p.confirm_count / p.total) * 100) : 0
          const disputePct = p.total > 0 ? 100 - confirmPct : 0
          const { text: stText, color: stColor } = statusLabel(p)
          return (
            <div
              key={p.id}
              style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, paddingRight: 10 }}>
                  {p.title ?? 'Untitled vote'}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: stColor, flexShrink: 0, letterSpacing: '0.3px' }}>
                  {stText}
                </span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--green)' }}>Confirm {confirmPct}%</span>
                  <span style={{ color: 'var(--red)' }}>Dispute {disputePct}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${confirmPct}%`, background: 'var(--green)', borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                {p.confirm_count} confirm / {p.dispute_count} dispute
                {p.voting_deadline && (
                  <span style={{ marginLeft: 10 }}>
                    · Deadline: {new Date(p.voting_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {posts.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '52px 20px', color: 'var(--muted2)', textAlign: 'center' }}>
            <i className="ph-bold ph-chart-bar" style={{ fontSize: 32, opacity: 0.25 }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>No voting posts yet</div>
            <div style={{ fontSize: 11, maxWidth: 260, lineHeight: 1.6 }}>
              Community votes will appear here once the project creates voting posts.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type VerifyStatus = 'idle' | 'loading' | 'holds' | 'no-holding' | 'error'

interface HolderRow { wallet_address: string; verified_at: string; balance_raw: string }

function HoldersTab({
  tokenAddress, slug, address,
}: {
  tokenAddress: string | null
  slug: string
  address?: string
}) {
  const addr  = tokenAddress?.trim()
  const short = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : null

  const [holders,      setHolders]      = useState<HolderRow[]>([])
  const [holdersLoad,  setHoldersLoad]  = useState(true)
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifyBal,    setVerifyBal]    = useState('')

  useEffect(() => {
    if (!addr) { setHoldersLoad(false); return }
    fetch(`/api/projects/${slug}/holders`)
      .then(r => r.json())
      .then(({ holders: h }: { holders: HolderRow[] }) => setHolders(h ?? []))
      .catch(() => {})
      .finally(() => setHoldersLoad(false))
  }, [addr, slug])

  const handleVerify = async () => {
    if (!address) return
    setVerifyStatus('loading')
    try {
      const res  = await fetch(`/api/projects/${slug}/verify-holding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      })
      const data = await res.json()
      if (!res.ok) { setVerifyStatus('error'); return }
      if (data.holds) {
        setVerifyBal(data.balance)
        setVerifyStatus('holds')
        // Refresh list
        fetch(`/api/projects/${slug}/holders`)
          .then(r => r.json())
          .then(({ holders: h }: { holders: HolderRow[] }) => setHolders(h ?? []))
          .catch(() => {})
      } else {
        setVerifyStatus('no-holding')
      }
    } catch {
      setVerifyStatus('error')
    }
  }

  if (!addr) {
    return (
      <div className="roadmap-promises">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '52px 20px', color: 'var(--muted2)', textAlign: 'center' }}>
          <i className="ph-bold ph-coin" style={{ fontSize: 32, opacity: 0.22 }} />
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>No token configured</div>
          <div style={{ fontSize: 11, maxWidth: 260, lineHeight: 1.65 }}>
            The project team hasn't linked a token contract yet. Holder data will appear here once they do.
          </div>
        </div>
      </div>
    )
  }

  const myWallet     = address?.toLowerCase()
  const alreadyInList = myWallet ? holders.some(h => h.wallet_address === myWallet) : false

  return (
    <div className="roadmap-promises">
      <div className="concept-head">
        <div>
          <div className="concept-title">Token Holders</div>
          <div className="concept-sub">Verified holders on Base Mainnet · {holders.length} verified</div>
        </div>
      </div>

      {/* Contract info */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 6 }}>Contract</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'monospace' }}>{short}</span>
          <button
            onClick={() => navigator.clipboard.writeText(addr)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted2)', padding: 2, fontSize: 12, lineHeight: 1 }}
            title="Copy address"
          >
            <i className="ph-bold ph-copy" />
          </button>
          <a
            href={`https://basescan.org/token/${addr}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--muted2)', fontSize: 12, lineHeight: 1 }}
            title="View on Basescan"
          >
            <i className="ph-bold ph-arrow-square-out" />
          </a>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Base Mainnet</div>
      </div>

      {/* Verify button / result */}
      {address && !alreadyInList && verifyStatus !== 'holds' && (
        <div style={{ marginBottom: 12 }}>
          <button
            className="action-btn"
            onClick={handleVerify}
            disabled={verifyStatus === 'loading'}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {verifyStatus === 'loading'
              ? <><i className="ph-bold ph-spinner" /> Checking on-chain…</>
              : <><i className="ph-bold ph-shield-check" /> Verify holding</>}
          </button>
          {verifyStatus === 'no-holding' && (
            <div style={{ marginTop: 7, fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>
              Your wallet holds 0 of this token on Base Mainnet.
            </div>
          )}
          {verifyStatus === 'error' && (
            <div style={{ marginTop: 7, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Could not read chain data — try again.
            </div>
          )}
        </div>
      )}

      {verifyStatus === 'holds' && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(101,191,127,0.08)', border: '0.5px solid rgba(101,191,127,0.25)', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ph-bold ph-shield-check" style={{ color: 'var(--green)', fontSize: 16 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>Verified holder</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Balance: {verifyBal} tokens</div>
          </div>
        </div>
      )}

      {/* Holders list */}
      {holdersLoad ? (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--muted2)' }}>Loading…</div>
      ) : holders.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 20px', color: 'var(--muted2)', textAlign: 'center' }}>
          <i className="ph-bold ph-users" style={{ fontSize: 28, opacity: 0.22 }} />
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>No verified holders yet</div>
          <div style={{ fontSize: 11, maxWidth: 260, lineHeight: 1.65 }}>
            Connect your wallet and click "Verify holding" to appear here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {holders.map((h, i) => {
            const isMe = h.wallet_address === myWallet
            const daysAgo = Math.floor((Date.now() - new Date(h.verified_at).getTime()) / 86_400_000)
            const when = daysAgo === 0 ? 'today' : daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                background: isMe ? 'rgba(201,165,90,0.05)' : 'rgba(255,255,255,0.02)',
                border: `0.5px solid ${isMe ? 'rgba(201,165,90,0.18)' : 'rgba(255,255,255,0.055)'}`,
                borderRadius: 8,
              }}>
                <i className="ph-bold ph-shield-check" style={{ color: isMe ? 'var(--gold)' : 'var(--green)', fontSize: 13, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: isMe ? 'var(--gold)' : 'var(--text)' }}>
                  {h.wallet_address.slice(0, 6)}…{h.wallet_address.slice(-4)}
                  {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--muted2)' }}>(you)</span>}
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted2)', flexShrink: 0 }}>{when}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Emergency Call types ─────────────────────────────────────────────────────

interface EmergencyCallData {
  id: string
  status: 'collecting' | 'active'
  reason: string
  pool_zxp: number
  participant_count: number
  collecting_until: string | null
  response_until: string | null
  created_at: string
  initiator_wallet: string
}

interface EmergencyConfig {
  pool_goal: number
  min_wallets: number
  max_amount: number
  min_amount: number
}

type EmergencyPhase = 'collecting' | 'responding' | 'voting' | null

interface EmergencyVerdict {
  post_id: string
  voting_deadline: string | null
  confirmWeight: number
  disputeWeight: number
  confirmCount: number
  disputeCount: number
  total: number
}

const DEFAULT_EM_CONFIG: EmergencyConfig = { pool_goal: 300, min_wallets: 5, max_amount: 60, min_amount: 5 }

// ── Analytics Tab ─────────────────────────────────────────────────────────────

interface AnalyticsData {
  watchlist_total: number
  watchlist_7d: number
  watchlist_30d: number
  views_total: number
  views_7d: number
  posts_count: number
  votes_confirm: number
  votes_dispute: number
  trust_score: number
  trust_delta_30d: number
  top_posts: { id: string; title: string; type: string; views: number; votes: number; created_at: string }[]
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function AnalyticsTab({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading) return (
    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[80, 60, 100, 70].map((w, i) => (
        <div key={i} className="skel" style={{ height: 18, width: `${w}%`, borderRadius: 6, animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )

  if (!data) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 13 }}>
      Could not load analytics
    </div>
  )

  const totalVotes = data.votes_confirm + data.votes_dispute
  const confirmPct = totalVotes > 0 ? Math.round((data.votes_confirm / totalVotes) * 100) : 0

  const statCard = (
    label: string,
    value: string,
    sub: string,
    subPositive?: boolean,
  ) => (
    <div style={{
      background: 'transparent', borderRadius: 10,
      border: '0.5px solid rgba(255,255,255,0.07)', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: 'var(--muted2)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: subPositive === false ? 'var(--muted2)' : subPositive ? '#6fcf83' : 'var(--muted)' }}>{sub}</div>
    </div>
  )

  return (
    <div className="ui-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>

      {/* ── Top stats ── */}
      <div className="analytics-stat-grid">
        {statCard('Watching', fmt(data.watchlist_total),
          data.watchlist_7d > 0 ? `+${data.watchlist_7d} this week` : 'No new this week',
          data.watchlist_7d > 0)}
        {statCard('Views', fmt(data.views_total),
          data.views_7d > 0 ? `+${fmt(data.views_7d)} this week` : 'No new this week',
          data.views_7d > 0)}
        {statCard('Posts', String(data.posts_count), 'published', undefined)}
        {statCard('Trust Score', String(data.trust_score),
          data.trust_delta_30d > 0 ? `+${data.trust_delta_30d} last 30d` :
          data.trust_delta_30d < 0 ? `${data.trust_delta_30d} last 30d` : 'stable',
          data.trust_delta_30d > 0 ? true : data.trust_delta_30d < 0 ? false : undefined)}
      </div>

      {/* ── Community sentiment ── */}
      {totalVotes > 0 && (
        <div style={{ background: 'transparent', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.07)', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 10 }}>
            Community Sentiment — {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
          </div>
          <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${confirmPct}%`, background: 'linear-gradient(90deg,#4caf7d,#6fcf83)', borderRadius: 4, transition: 'width 0.6s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ color: '#6fcf83', fontWeight: 600 }}>✓ Confirm {confirmPct}%</span>
            <span style={{ color: '#e07070', fontWeight: 600 }}>{100 - confirmPct}% Dispute ✗</span>
          </div>
        </div>
      )}

      {/* ── Top posts ── */}
      {data.top_posts.length > 0 && (
        <div style={{ background: 'transparent', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border2)', fontSize: 10, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: 'var(--muted2)' }}>
            Top Posts by Views
          </div>
          {data.top_posts.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px',
              borderBottom: i < data.top_posts.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <span style={{ fontSize: 11, color: 'var(--muted2)', minWidth: 16, textAlign: 'center' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>{p.type}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  <i className="ph-bold ph-eye" style={{ marginRight: 3, fontSize: 10 }} />{fmt(p.views)}
                </span>
                {p.votes > 0 && (
                  <span className="analytics-top-post-votes" style={{ fontSize: 11, color: 'var(--muted)' }}>
                    <i className="ph-bold ph-check-square" style={{ marginRight: 3, fontSize: 10 }} />{p.votes}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.top_posts.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 12, padding: '16px 0' }}>
          No posts yet — publish your first update to start tracking views
        </div>
      )}
    </div>
  )
}

function timeRemainingLabel(iso: string | null): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`
  if (h >= 1)  return `${h}h ${m}m left`
  return `${m}m left`
}

function EmergencyCallModal({
  call,
  projectId,
  wallet,
  config,
  isAdmin,
  phase,
  verdict,
  responded,
  onClose,
  onUpdated,
  onReload,
}: {
  call: EmergencyCallData | null
  projectId: string
  wallet: string | undefined
  config: EmergencyConfig
  isAdmin: boolean
  phase: EmergencyPhase
  verdict: EmergencyVerdict | null
  responded: boolean
  onClose: () => void
  onUpdated: (c: EmergencyCallData | null) => void
  onReload: () => void
}) {
  const [amount,    setAmount]    = useState(config.min_amount)
  const [reason,    setReason]    = useState('')
  const [responseText, setResponseText] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState<string | null>(null)

  async function submitResponse() {
    if (!wallet || responseText.trim().length < 10) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/emergency/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, content: responseText.trim() }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSuccess('Response published. The community will review it.')
      onReload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function castVerdict(vote: 'confirm' | 'dispute') {
    if (!wallet || !verdict) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/posts/${verdict.post_id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSuccess(vote === 'confirm' ? 'Voted: project addressed it.' : 'Voted: problem unresolved.')
      onReload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const poolPct      = call ? Math.min(100, Math.round((call.pool_zxp / config.pool_goal) * 100)) : 0
  const walletNeeded = call ? Math.max(0, config.min_wallets - call.participant_count) : 0

  async function openCall() {
    if (!wallet) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/emergency/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, project_id: projectId, reason, amount }),
      })
      const data = await res.json() as { ok?: boolean; call?: EmergencyCallData; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSuccess('Emergency Call opened!')
      onUpdated(data.call ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function joinCall() {
    if (!wallet || !call) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/emergency/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, call_id: call.id, amount }),
      })
      const data = await res.json() as { ok?: boolean; pool_zxp?: number; participant_count?: number; activated?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSuccess(data.activated ? 'Emergency Call activated! Project has 48h to respond.' : 'Joined successfully!')
      onUpdated({
        ...call,
        pool_zxp:          data.pool_zxp ?? call.pool_zxp,
        participant_count: data.participant_count ?? call.participant_count,
        status:            data.activated ? 'active' : 'collecting',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)', border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ph-bold ph-warning" style={{ fontSize: 16, color: '#e07070' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Emergency Call</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted2)', fontSize: 16, padding: 4, lineHeight: 1 }}>
            <i className="ph-bold ph-x" />
          </button>
        </div>

        <div style={{ padding: '18px' }}>
          {/* ── No active call → open one ───────────────────────────── */}
          {!call && (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 14 }}>
                Raise a community alarm if this project is showing signs of a rug, scam, or major breach of trust.
                Requires ≥5 ZXP staked, account ≥14 days old, and ≥3 days on watchlist.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--muted2)', display: 'block', marginBottom: 5 }}>
                    REASON <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(min 10 chars)</span>
                  </label>
                  <textarea
                    className="create-textarea"
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Describe the concern clearly — e.g. team abandoned socials, contract renounced unexpectedly…"
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 3, textAlign: 'right' }}>{reason.length} chars</div>
                </div>

                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--muted2)', display: 'block', marginBottom: 5 }}>
                    YOUR STAKE ({config.min_amount}–{config.max_amount} ZXP)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setAmount(a => Math.max(config.min_amount, a - 5))} style={{ width: 30, height: 30, borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>−</button>
                    <input
                      type="range" min={config.min_amount} max={config.max_amount} step={5}
                      value={amount}
                      onChange={e => setAmount(+e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button onClick={() => setAmount(a => Math.min(config.max_amount, a + 5))} style={{ width: 30, height: 30, borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>+</button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 48, textAlign: 'right' }}>{amount} ZXP</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 3 }}>
                    Pool goal: {config.pool_goal} ZXP from ≥{config.min_wallets} wallets within 48h.
                    ZXP is burned if call is judged a false alarm.
                  </div>
                </div>

                {error  && <div style={{ fontSize: 12, color: 'var(--red)'   }}><i className="ph-bold ph-warning-circle" style={{ marginRight: 5 }} />{error}</div>}
                {success && <div style={{ fontSize: 12, color: 'var(--green)' }}><i className="ph-bold ph-check-circle"  style={{ marginRight: 5 }} />{success}</div>}

                {!success && (
                  <button
                    onClick={openCall}
                    disabled={loading || !wallet || reason.length < 10}
                    style={{
                      padding: '10px 16px', borderRadius: 9,
                      background: 'rgba(224,112,112,0.14)', border: '0.5px solid rgba(224,112,112,0.45)',
                      color: '#e07070', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                      cursor: (loading || !wallet || reason.length < 10) ? 'not-allowed' : 'pointer',
                      opacity: (loading || !wallet || reason.length < 10) ? 0.55 : 1,
                    }}
                  >
                    {loading ? 'Opening…' : !wallet ? 'Connect wallet first' : `Stake ${amount} ZXP & Open Call`}
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Active call (collecting) ─────────────────────────────── */}
          {call?.status === 'collecting' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 6 }}>REASON</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  {call.reason}
                </div>
              </div>

              {/* Pool progress */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
                  <span>Pool: <strong style={{ color: 'var(--text)' }}>{call.pool_zxp} / {config.pool_goal} ZXP</strong></span>
                  <span>{call.participant_count} wallet{call.participant_count !== 1 ? 's' : ''} · {walletNeeded > 0 ? `${walletNeeded} more needed` : `≥${config.min_wallets} ✓`}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${poolPct}%`, background: '#e07070', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 4, textAlign: 'right' }}>
                  {call.collecting_until ? timeRemainingLabel(call.collecting_until) : ''}
                </div>
              </div>

              {/* Join form */}
              {call.initiator_wallet !== wallet?.toLowerCase() && (
                <>
                  <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 14, marginBottom: 10 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--muted2)', display: 'block', marginBottom: 5 }}>
                      ADD YOUR STAKE ({config.min_amount}–{config.max_amount} ZXP)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setAmount(a => Math.max(config.min_amount, a - 5))} style={{ width: 30, height: 30, borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>−</button>
                      <input
                        type="range" min={config.min_amount} max={config.max_amount} step={5}
                        value={amount}
                        onChange={e => setAmount(+e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button onClick={() => setAmount(a => Math.min(config.max_amount, a + 5))} style={{ width: 30, height: 30, borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>+</button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 48, textAlign: 'right' }}>{amount} ZXP</span>
                    </div>
                  </div>

                  {error   && <div style={{ fontSize: 12, color: 'var(--red)',   marginBottom: 10 }}><i className="ph-bold ph-warning-circle" style={{ marginRight: 5 }} />{error}</div>}
                  {success && <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 10 }}><i className="ph-bold ph-check-circle"  style={{ marginRight: 5 }} />{success}</div>}

                  {!success && (
                    <button
                      onClick={joinCall}
                      disabled={loading || !wallet}
                      style={{
                        width: '100%', padding: '10px 16px', borderRadius: 9,
                        background: 'rgba(224,112,112,0.14)', border: '0.5px solid rgba(224,112,112,0.45)',
                        color: '#e07070', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                        cursor: (loading || !wallet) ? 'not-allowed' : 'pointer',
                        opacity: (loading || !wallet) ? 0.55 : 1,
                      }}
                    >
                      {loading ? 'Joining…' : !wallet ? 'Connect wallet first' : `Stake ${amount} ZXP & Join`}
                    </button>
                  )}
                </>
              )}
              {call.initiator_wallet === wallet?.toLowerCase() && (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>
                  You opened this call. Waiting for community support…
                </div>
              )}
            </>
          )}

          {/* ── Active call: project response window ─────────────────── */}
          {call?.status === 'active' && phase === 'responding' && (
            <div style={{ padding: '8px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🚨</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e07070', marginBottom: 8 }}>Emergency Call ACTIVE</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65 }}>
                  The pool goal was reached. The project team must respond publicly within 48 hours — then
                  stakers vote on the verdict.
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 10 }}>
                  Pool: <strong style={{ color: 'var(--text)' }}>{call.pool_zxp} ZXP</strong>
                  {' · '}{call.participant_count} participants
                </div>
                {call.response_until && (
                  <div style={{ fontSize: 11, color: '#e07070', marginTop: 6 }}>
                    {timeRemainingLabel(call.response_until)} to respond
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted)', borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 12, lineHeight: 1.65 }}>
                <strong style={{ color: 'var(--text)' }}>Reason:</strong> {call.reason}
              </div>

              {responded && (
                <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 12 }}>
                  <i className="ph-bold ph-check-circle" style={{ marginRight: 5 }} />
                  The project has posted a public response.
                </div>
              )}

              {isAdmin && !responded && (
                <div style={{ marginTop: 14, borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--muted2)', display: 'block', marginBottom: 5 }}>
                    YOUR PUBLIC RESPONSE
                  </label>
                  <textarea
                    className="create-textarea"
                    rows={4}
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    placeholder="Address the concern directly. Link on-chain proof, commits, or an explanation the community can verify."
                  />
                  {error   && <div style={{ fontSize: 12, color: 'var(--red)',   marginTop: 8 }}><i className="ph-bold ph-warning-circle" style={{ marginRight: 5 }} />{error}</div>}
                  {success && <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 8 }}><i className="ph-bold ph-check-circle"  style={{ marginRight: 5 }} />{success}</div>}
                  {!success && (
                    <button
                      onClick={submitResponse}
                      disabled={loading || responseText.trim().length < 10}
                      style={{
                        width: '100%', marginTop: 10, padding: '10px 16px', borderRadius: 9,
                        background: 'rgba(111,155,229,0.14)', border: '0.5px solid rgba(111,155,229,0.45)',
                        color: '#6f9be5', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                        cursor: (loading || responseText.trim().length < 10) ? 'not-allowed' : 'pointer',
                        opacity: (loading || responseText.trim().length < 10) ? 0.55 : 1,
                      }}
                    >
                      {loading ? 'Publishing…' : 'Publish response'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Active call: community verdict vote ──────────────────── */}
          {call?.status === 'active' && phase === 'voting' && verdict && (
            <div style={{ padding: '8px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>⚖️</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Community Verdict</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  The response window has closed. Stakers now decide the outcome.
                </div>
                <div style={{ fontSize: 11, marginTop: 8, color: responded ? 'var(--green)' : '#e07070' }}>
                  {responded ? '✓ Project responded' : '✗ Project did not respond'}
                </div>
                {verdict.voting_deadline && (
                  <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>
                    {timeRemainingLabel(verdict.voting_deadline)}
                  </div>
                )}
              </div>

              {/* Tally bar */}
              {(() => {
                const tot = verdict.confirmWeight + verdict.disputeWeight
                const confirmPct = tot > 0 ? Math.round((verdict.confirmWeight / tot) * 100) : 50
                return (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ height: '100%', width: `${confirmPct}%`, background: 'linear-gradient(90deg,#4caf7d,#6fcf83)', borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                      <span style={{ color: '#6fcf83', fontWeight: 600 }}>✓ Addressed {confirmPct}%</span>
                      <span style={{ color: '#e07070', fontWeight: 600 }}>{100 - confirmPct}% Unresolved ✗</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 4, textAlign: 'center' }}>
                      {verdict.total} vote{verdict.total !== 1 ? 's' : ''} cast
                    </div>
                  </div>
                )
              })()}

              <div style={{ fontSize: 12, color: 'var(--muted)', borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 12, lineHeight: 1.65, marginBottom: 14 }}>
                <strong style={{ color: 'var(--text)' }}>Reason:</strong> {call.reason}
              </div>

              {error   && <div style={{ fontSize: 12, color: 'var(--red)',   marginBottom: 10 }}><i className="ph-bold ph-warning-circle" style={{ marginRight: 5 }} />{error}</div>}
              {success && <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 10 }}><i className="ph-bold ph-check-circle"  style={{ marginRight: 5 }} />{success}</div>}

              {!success && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => castVerdict('confirm')}
                    disabled={loading || !wallet}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 9,
                      background: 'rgba(111,207,131,0.12)', border: '0.5px solid rgba(111,207,131,0.45)',
                      color: '#6fcf83', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                      cursor: (loading || !wallet) ? 'not-allowed' : 'pointer', opacity: (loading || !wallet) ? 0.55 : 1,
                    }}
                  >
                    Addressed
                  </button>
                  <button
                    onClick={() => castVerdict('dispute')}
                    disabled={loading || !wallet}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 9,
                      background: 'rgba(224,112,112,0.12)', border: '0.5px solid rgba(224,112,112,0.45)',
                      color: '#e07070', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                      cursor: (loading || !wallet) ? 'not-allowed' : 'pointer', opacity: (loading || !wallet) ? 0.55 : 1,
                    }}
                  >
                    Unresolved
                  </button>
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 8, textAlign: 'center' }}>
                Voting requires ≥10 ZXP staked · costs 1 ZXP
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BlueToggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative',
        background: checked ? 'rgba(111,155,229,0.35)' : 'var(--border2)',
        transition: 'background 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', width: 14, height: 14, borderRadius: '50%',
        background: checked ? '#6f9be5' : 'var(--muted2)',
        top: 3, left: checked ? 19 : 3, transition: 'left 0.2s, background 0.2s',
      }} />
    </button>
  )
}

export default function ProjectProfilePage() {
  const params  = useParams()
  const router  = useRouter()
  const { address } = useAppKitAccount()

  const [activeTab,          setActiveTab]          = useState<Tab>('posts')
  const [watchlisted,        setWatchlisted]        = useState(false)
  const [projectDbId,        setProjectDbId]        = useState<string | null>(null)
  const [watchlistLoading,   setWatchlistLoading]   = useState(false)
  const [posts,              setPosts]              = useState<FeedPost[]>([])
  const [loadingPosts,       setLoadingPosts]       = useState(false)
  const [selectedPost,       setSelectedPost]       = useState<FeedPost | null>(null)
  const [scrollToComments,   setScrollToComments]   = useState(false)
  const [isAdmin,            setIsAdmin]            = useState(false)
  const [createOpen,         setCreateOpen]         = useState(false)

  // Votes tab — real data
  const [votingPosts,    setVotingPosts]    = useState<VotingPostProps[]>([])
  const [votingLoading,  setVotingLoading]  = useState(false)

  // Trust Timeline — real data
  const [trustHistory, setTrustHistory] = useState<TrustEventProp[]>([])

  // Roadmap
  const [milestones,         setMilestones]         = useState<Milestone[]>([])
  const [milestonesLoading,  setMilestonesLoading]  = useState(false)
  const [newMs,              setNewMs]              = useState({ year: new Date().getFullYear(), quarter: 1, title: '', description: '', status: 'upcoming' as Milestone['status'] })
  const [addingMs,           setAddingMs]           = useState(false)
  const [msError,            setMsError]            = useState<string | null>(null)

  // Live project settings from DB
  const [showHolders,  setShowHolders]  = useState(true)
  const [showVotes,    setShowVotes]    = useState(true)
  const [hasToken,     setHasToken]     = useState(false)
  const [socialLinks,  setSocialLinks]  = useState<SocialLinks>({
    website_url: null, whitepaper_url: null, github_url: null,
    twitter_url: null, discord_url: null, avatar_url: null,
  })

  // Edit state (shown in Settings tab)
  const [editName,        setEditName]        = useState('')
  const [editDesc,        setEditDesc]        = useState('')
  const [editCategory,    setEditCategory]    = useState('')
  const [editWebsite,     setEditWebsite]     = useState('')
  const [editWhitepaper,  setEditWhitepaper]  = useState('')
  const [editGithub,      setEditGithub]      = useState('')
  const [editTwitter,     setEditTwitter]     = useState('')
  const [editDiscord,     setEditDiscord]     = useState('')
  const [editAvatarUrl,      setEditAvatarUrl]      = useState('')
  const [uploadingAvatar,    setUploadingAvatar]    = useState(false)
  const [avatarUploadMsg,    setAvatarUploadMsg]    = useState<string | null>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const tabsRef       = useRef<HTMLDivElement>(null)
  const [tabsCanLeft,  setTabsCanLeft]  = useState(false)
  const [tabsCanRight, setTabsCanRight] = useState(false)

  function updateTabsArrows() {
    const el = tabsRef.current
    if (!el) return
    setTabsCanLeft(el.scrollLeft > 4)
    setTabsCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }
  const [editShowHolders,    setEditShowHolders]    = useState(true)
  const [editShowVotes,      setEditShowVotes]      = useState(true)
  const [editHasToken,       setEditHasToken]       = useState(false)
  const [tokenAddress,       setTokenAddress]       = useState<string | null>(null)
  const [editTokenAddress,   setEditTokenAddress]   = useState('')
  const [saving,          setSaving]          = useState(false)
  const [saveMsg,         setSaveMsg]         = useState<string | null>(null)
  const [dbProject,       setDbProject]       = useState<DbProjectData | null>(null)
  const [dbLoading,       setDbLoading]       = useState(true)
  const [monthlyDelta,    setMonthlyDelta]    = useState<number | null>(null)

  // Emergency Call
  const [emergencyCall,    setEmergencyCall]    = useState<EmergencyCallData | null>(null)
  const [emergencyConfig,  setEmergencyConfig]  = useState<EmergencyConfig>(DEFAULT_EM_CONFIG)
  const [emergencyPhase,   setEmergencyPhase]   = useState<EmergencyPhase>(null)
  const [emergencyVerdict, setEmergencyVerdict] = useState<EmergencyVerdict | null>(null)
  const [emergencyResponded, setEmergencyResponded] = useState(false)
  const [emergencyOpen,    setEmergencyOpen]    = useState(false)

  // Analytics (admin only)
  const [analyticsData,    setAnalyticsData]    = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Holder count for Stats panel
  const [holderCount, setHolderCount] = useState<number | null>(null)

  const slug          = Array.isArray(params.slug) ? params.slug[0] : params.slug
  const staticProject = PROJECTS_FULL.find(p => p.id === slug)

  // DB data is authoritative — static PROJECTS_FULL is only a last-resort
  // fallback for projects not yet in the database. Never mix them.
  const effectiveProject: ProjectFull | null = dbProject
    ? buildProjectFull(dbProject)
    : (dbLoading ? null : (staticProject ?? null))

  // Load posts for this project
  useEffect(() => {
    if (!slug) return
    setLoadingPosts(true)
    fetch(`/api/posts?project_slug=${slug}&limit=30`)
      .then(r => r.json())
      .then(({ posts: rows }: { posts: DbPost[] }) => { if (rows) setPosts(rows.map(dbToFeedPost)) })
      .catch(console.error)
      .finally(() => setLoadingPosts(false))
  }, [slug])

  // Load live project settings + social links (public read)
  useEffect(() => {
    if (!slug) return
    supabase
      .from('projects')
      .select('id, name, slug, category, description, trust_score, is_verified, created_at, show_holders, show_votes, has_token, token_address, website_url, whitepaper_url, github_url, twitter_url, discord_url, avatar_url')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProjectDbId(data.id)
          setDbProject({
            name:        data.name,
            slug:        data.slug ?? slug,
            category:    data.category ?? null,
            description: data.description ?? null,
            trust_score: data.trust_score ?? 0,
            is_verified: data.is_verified ?? false,
            created_at:  data.created_at,
          })
          setShowHolders(data.show_holders ?? true)
          setShowVotes(data.show_votes ?? true)
          setHasToken(data.has_token ?? false)
          setTokenAddress(data.token_address ?? null)
          setSocialLinks({
            website_url:    data.website_url    ?? null,
            whitepaper_url: data.whitepaper_url ?? null,
            github_url:     data.github_url     ?? null,
            twitter_url:    data.twitter_url    ?? null,
            discord_url:    data.discord_url    ?? null,
            avatar_url:     data.avatar_url     ?? null,
          })
        }
        setDbLoading(false)
      })
  }, [slug])

  // Admin check
  useEffect(() => {
    if (!address || !slug) { setIsAdmin(false); return }
    fetch(`/api/check-role?wallet=${address}`)
      .then(r => r.json())
      .then((data: {
        role: string;
        project: {
          slug: string; name: string; description: string | null;
          category: string | null; website_url: string | null;
          whitepaper_url: string | null; github_url: string | null;
          twitter_url: string | null; discord_url: string | null;
          avatar_url: string | null;
          show_holders: boolean; show_votes: boolean; has_token: boolean;
          token_address: string | null;
        } | null
      }) => {
        if (data.role === 'project' && data.project && data.project.slug === slug) {
          setIsAdmin(true)
          const p = data.project
          setEditName(p.name)
          setEditDesc(p.description ?? '')
          setEditCategory(p.category ?? '')
          setEditWebsite(p.website_url ?? '')
          setEditWhitepaper(p.whitepaper_url ?? '')
          setEditGithub(p.github_url ?? '')
          setEditTwitter(p.twitter_url ?? '')
          setEditDiscord(p.discord_url ?? '')
          setEditAvatarUrl(p.avatar_url ?? '')
          setEditShowHolders(p.show_holders ?? true)
          setEditShowVotes(p.show_votes ?? true)
          setEditHasToken(p.has_token ?? false)
          setEditTokenAddress(p.token_address ?? '')
        } else {
          setIsAdmin(false)
        }
      })
      .catch(() => setIsAdmin(false))
  }, [address, slug])

  // Fetch Trust Score change for current calendar month
  useEffect(() => {
    if (!projectDbId) return
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    supabase
      .from('posts')
      .select('trust_score_change')
      .eq('project_id', projectDbId)
      .eq('voting_finalized', true)  // only count finalized votes
      .gte('created_at', startOfMonth.toISOString())
      .then(async ({ data }) => {
        const delta = (data ?? []).reduce(
          (sum, p) => sum + ((p.trust_score_change as number) ?? 0), 0,
        )
        // Also include alert/update/verdict posts (trust_score_change applied at creation)
        const { data: otherPosts } = await supabase
          .from('posts')
          .select('trust_score_change')
          .eq('project_id', projectDbId)
          .in('post_type', ['alert', 'update', 'verdict'])
          .gte('created_at', startOfMonth.toISOString())
        const otherDelta = (otherPosts ?? []).reduce(
          (sum, p) => sum + ((p.trust_score_change as number) ?? 0), 0,
        )
        setMonthlyDelta(delta + otherDelta)
      })
  }, [projectDbId])

  // Load milestones
  useEffect(() => {
    if (!projectDbId) return
    setMilestonesLoading(true)
    fetch(`/api/milestones?project_id=${projectDbId}`)
      .then(r => r.json())
      .then(({ milestones: ms }: { milestones: Milestone[] }) => setMilestones(ms ?? []))
      .catch(() => {})
      .finally(() => setMilestonesLoading(false))
  }, [projectDbId])

  // Load voting posts + vote counts
  useEffect(() => {
    if (!projectDbId) return
    setVotingLoading(true)
    ;(async () => {
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, title, created_at, voting_deadline, voting_finalized, trust_score_change')
        .eq('project_id', projectDbId)
        .eq('post_type', 'voting')
        .order('created_at', { ascending: false })
        .limit(30)

      if (!postsData || postsData.length === 0) {
        setVotingPosts([])
        setVotingLoading(false)
        return
      }

      const postIds = postsData.map(p => p.id)
      const { data: votesData } = await supabase
        .from('voting_votes')
        .select('post_id, vote')
        .in('post_id', postIds)

      const countMap = new Map<string, { confirm: number; dispute: number }>()
      for (const id of postIds) countMap.set(id, { confirm: 0, dispute: 0 })
      for (const v of votesData ?? []) {
        const entry = countMap.get(v.post_id as string)
        if (!entry) continue
        if (v.vote === 'confirm') entry.confirm += 1
        else if (v.vote === 'dispute') entry.dispute += 1
      }

      setVotingPosts(
        postsData.map(p => {
          const c = countMap.get(p.id) ?? { confirm: 0, dispute: 0 }
          return {
            id:                p.id,
            title:             p.title as string | null,
            created_at:        p.created_at as string,
            voting_deadline:   p.voting_deadline as string | null,
            voting_finalized:  p.voting_finalized as boolean,
            trust_score_change: p.trust_score_change as number | null,
            confirm_count:     c.confirm,
            dispute_count:     c.dispute,
            total:             c.confirm + c.dispute,
          }
        }),
      )
      setVotingLoading(false)
    })()
  }, [projectDbId])

  // Load trust score history
  useEffect(() => {
    if (!projectDbId) return
    supabase
      .from('trust_score_log')
      .select('id, delta, reason, score_after, created_at')
      .eq('project_id', projectDbId)
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => setTrustHistory((data ?? []) as TrustEventProp[]))
  }, [projectDbId])

  // Load emergency call for this project
  const reloadEmergency = useCallback(() => {
    if (!projectDbId) return
    fetch(`/api/emergency?project_id=${projectDbId}`)
      .then(r => r.json())
      .then(({ call, config, phase, verdict, responded }: {
        call: EmergencyCallData | null
        config?: EmergencyConfig
        phase?: EmergencyPhase
        verdict?: EmergencyVerdict | null
        responded?: boolean
      }) => {
        setEmergencyCall(call ?? null)
        if (config) setEmergencyConfig(config)
        setEmergencyPhase(phase ?? null)
        setEmergencyVerdict(verdict ?? null)
        setEmergencyResponded(!!responded)
      })
      .catch(() => {})
  }, [projectDbId])

  useEffect(() => { reloadEmergency() }, [reloadEmergency])

  // Load analytics when admin switches to analytics tab
  useEffect(() => {
    if (!isAdmin || !slug || !address || analyticsData || analyticsLoading) return
    if (activeTab !== 'analytics') return
    setAnalyticsLoading(true)
    fetch(`/api/projects/${slug}/analytics?wallet=${address.toLowerCase()}`)
      .then(r => r.json())
      .then((d: AnalyticsData) => setAnalyticsData(d))
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false))
  }, [activeTab, isAdmin, slug, address, analyticsData, analyticsLoading])

  // Re-check tab overflow whenever tab list changes (isAdmin resolves)
  useEffect(() => { setTimeout(updateTabsArrows, 50) }, [isAdmin, showVotes, showHolders])

  // Fetch verified holder count for Stats panel
  useEffect(() => {
    if (!slug) return
    fetch(`/api/projects/${slug}/holders`)
      .then(r => r.json())
      .then(({ holders: h }: { holders: unknown[] }) => setHolderCount((h ?? []).length))
      .catch(() => {})
  }, [slug])

  // Load watchlist status
  useEffect(() => {
    if (!address || !projectDbId) return
    fetch(`/api/watchlist?wallet=${address}`)
      .then(r => r.json())
      .then(({ items }: { items: { project_id: string }[] }) => {
        setWatchlisted(items.some(i => i.project_id === projectDbId))
      })
      .catch(() => {})
  }, [address, projectDbId])

  function refreshTrustScore() {
    if (!slug) return
    supabase
      .from('projects')
      .select('trust_score')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDbProject(prev => prev ? { ...prev, trust_score: data.trust_score } : prev)
      })
    // Re-fetch monthly delta so the trend updates immediately after a vote closes
    if (projectDbId) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      Promise.all([
        supabase.from('posts').select('trust_score_change')
          .eq('project_id', projectDbId).eq('voting_finalized', true)
          .gte('created_at', startOfMonth.toISOString()),
        supabase.from('posts').select('trust_score_change')
          .eq('project_id', projectDbId).in('post_type', ['alert', 'update', 'verdict'])
          .gte('created_at', startOfMonth.toISOString()),
      ]).then(([{ data: a }, { data: b }]) => {
        const delta =
          (a ?? []).reduce((s, p) => s + ((p.trust_score_change as number) ?? 0), 0) +
          (b ?? []).reduce((s, p) => s + ((p.trust_score_change as number) ?? 0), 0)
        setMonthlyDelta(delta)
      }).catch(() => {})
    }
  }

  async function toggleWatchlist() {
    if (!address || !projectDbId) return
    setWatchlistLoading(true)
    const method = watchlisted ? 'DELETE' : 'POST'
    await fetch('/api/watchlist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, project_id: projectDbId }),
    })
    setWatchlisted(w => !w)
    setWatchlistLoading(false)
  }

  async function addMilestone() {
    if (!address || !projectDbId || !newMs.title.trim()) return
    setAddingMs(true); setMsError(null)
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, project_id: projectDbId, ...newMs }),
      })
      const data = await res.json() as { milestone?: Milestone; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setMilestones(prev => [...prev, data.milestone!].sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter))
      setNewMs({ year: new Date().getFullYear(), quarter: 1, title: '', description: '', status: 'upcoming' })
    } catch (e) {
      setMsError(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingMs(false)
    }
  }

  async function deleteMilestone(id: string) {
    if (!address) return
    const res = await fetch(`/api/milestones?id=${id}&wallet=${address}`, { method: 'DELETE' })
    if (res.ok) setMilestones(prev => prev.filter(m => m.id !== id))
  }

  async function toggleMilestoneStatus(m: Milestone) {
    if (!address) return
    // Only allow toggling between upcoming and in_progress
    const next: Milestone['status'] = m.status === 'upcoming' ? 'in_progress' : 'upcoming'
    const res = await fetch('/api/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, id: m.id, status: next }),
    })
    if (res.ok) setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, status: next } : x))
  }

  async function submitForConfirmation(m: Milestone) {
    if (!address) return
    setMsError(null)
    const res = await fetch('/api/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, id: m.id, status: 'pending_confirmation' }),
    })
    const data = await res.json() as { milestone?: Milestone; voting_post_id?: string; error?: string }
    if (res.ok && data.milestone) {
      setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, status: 'pending_confirmation' } : x))
    } else {
      setMsError(data.error ?? 'Failed to submit for confirmation')
    }
  }

  async function saveProject() {
    if (!address) return
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet:         address,
          name:           editName,
          description:    editDesc,
          category:       editCategory,
          website_url:    editWebsite,
          whitepaper_url: editWhitepaper,
          github_url:     editGithub,
          twitter_url:    editTwitter,
          discord_url:    editDiscord,
          avatar_url:     editAvatarUrl,
          show_holders:   editShowHolders,
          show_votes:     editShowVotes,
          has_token:      editHasToken,
          token_address:  editTokenAddress,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }
      const { project: saved } = await res.json() as {
        project: {
          show_holders: boolean; show_votes: boolean; has_token: boolean;
          token_address: string | null;
          website_url: string | null; whitepaper_url: string | null;
          github_url: string | null; twitter_url: string | null;
          discord_url: string | null; avatar_url: string | null;
        }
      }
      setShowHolders(saved.show_holders)
      setShowVotes(saved.show_votes)
      setHasToken(saved.has_token)
      setTokenAddress(saved.token_address ?? null)
      setEditShowHolders(saved.show_holders)
      setEditShowVotes(saved.show_votes)
      setEditHasToken(saved.has_token)
      setEditTokenAddress(saved.token_address ?? '')
      // Update displayed social links immediately
      setSocialLinks({
        website_url:    saved.website_url    ?? null,
        whitepaper_url: saved.whitepaper_url ?? null,
        github_url:     saved.github_url     ?? null,
        twitter_url:    saved.twitter_url    ?? null,
        discord_url:    saved.discord_url    ?? null,
        avatar_url:     saved.avatar_url     ?? null,
      })
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!address || !slug) return
    setUploadingAvatar(true); setAvatarUploadMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('wallet', address)
      fd.append('slug', slug)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setEditAvatarUrl(data.url!)
      setSocialLinks(prev => ({ ...prev, avatar_url: data.url! }))
      setAvatarUploadMsg('Avatar updated!')
      setTimeout(() => setAvatarUploadMsg(null), 3000)
    } catch (e) {
      setAvatarUploadMsg(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (dbLoading) {
    return (
      <div className="shell">
        <Nav />
        <div className="center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        </div>
        <div className="right" />
      </div>
    )
  }

  if (!effectiveProject) {
    return (
      <div className="shell">
        <Nav />
        <div className="center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>404</div>
            <div>Project not found</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => router.push('/')}>
              Back to app
            </button>
          </div>
        </div>
        <div className="right" />
      </div>
    )
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'posts',    label: 'Posts' },
    { id: 'overview', label: 'Overview' },
    { id: 'roadmap',  label: 'Roadmap' },
    { id: 'timeline', label: 'Trust Timeline' },
    ...(showVotes   ? [{ id: 'votes'    as Tab, label: 'Votes' }]    : []),
    ...(showHolders ? [{ id: 'holders'  as Tab, label: 'Holders' }]  : []),
    ...(isAdmin     ? [{ id: 'analytics' as Tab, label: 'Analytics' }] : []),
    ...(isAdmin     ? [{ id: 'settings'  as Tab, label: 'Settings'   }] : []),
  ]

  // Social links for header display
  const headerLinks: { href: string; icon: string; title: string }[] = [
    socialLinks.website_url    ? { href: socialLinks.website_url,    icon: 'ph-bold ph-globe',          title: 'Website' }     : null,
    socialLinks.whitepaper_url ? { href: socialLinks.whitepaper_url, icon: 'ph-bold ph-file-text',      title: 'Whitepaper' }  : null,
    socialLinks.github_url     ? { href: socialLinks.github_url,     icon: 'ph-bold ph-github-logo',    title: 'GitHub' }      : null,
    socialLinks.twitter_url    ? { href: socialLinks.twitter_url,    icon: 'ph-bold ph-x-logo',         title: 'X / Twitter' } : null,
    socialLinks.discord_url    ? { href: socialLinks.discord_url,    icon: 'ph-bold ph-discord-logo',   title: 'Discord' }     : null,
  ].filter(Boolean) as { href: string; icon: string; title: string }[]

  return (
    <div className="shell">
      {/* Mobile-only fixed topbar — replaces the 56px shell padding-top */}
      <header className="proj-topbar">
        <button className="proj-topbar-back" onClick={() => router.back()}>
          <i className="ph-bold ph-arrow-left" />
        </button>
        <span className="proj-topbar-name">{effectiveProject.name}</span>
        <div style={{ width: 36 }} />
      </header>

      <Nav />

      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="proj-detail-header">
          <div className="back-btn" onClick={() => router.back()}>
            <i className="ph-bold ph-arrow-left" /> Back to projects
          </div>
          <div className="pdh-top">
            {/* Avatar — image if set, else letter */}
            {socialLinks.avatar_url ? (
              <img
                src={socialLinks.avatar_url}
                alt={effectiveProject.name}
                style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div className={`pdh-av ${effectiveProject.av}`} style={{ width: 52, height: 52, fontSize: 20 }}>{effectiveProject.letter}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pdh-name">{effectiveProject.name}</div>
              <div className="pdh-sub">{effectiveProject.cat}{effectiveProject.holders !== '—' ? ` · ${effectiveProject.holders} holders` : ''}</div>
              {/* Social link icons */}
              {headerLinks.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {headerLinks.map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={link.title}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: 7,
                        background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)',
                        color: 'var(--muted2)', fontSize: 14, textDecoration: 'none',
                        transition: 'color 0.14s, border-color 0.14s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted2)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
                    >
                      <i className={link.icon} />
                    </a>
                  ))}
                </div>
              )}
              <div className="plc-tags" style={{ marginTop: headerLinks.length > 0 ? 6 : undefined }}>
                {effectiveProject.tags.map((t, i) => (
                  <span key={i} className={`plc-tag${t.variant === 'verified' ? ' verified' : ''}`}>
                    {t.variant === 'verified' && <i className="ph-bold ph-check" style={{ fontSize: '9px' }} />}
                    {t.variant === 'verified' ? ' ' : ''}{t.label}
                  </span>
                ))}
              </div>
            </div>
            {/* Post button — admin only, prominent */}
            {isAdmin && (
              <button
                className="create-post-btn"
                onClick={() => setCreateOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  borderRadius: 9, marginLeft: 8, flexShrink: 0,
                }}
              >
                <i className="ph-bold ph-pencil-plus" style={{ fontSize: 15 }} />
                <span>Post</span>
              </button>
            )}
          </div>

          {/* Mobile summary bar — visible ≤900px via CSS, hidden on desktop */}
          <div className="proj-mob-bar">
            <div className="proj-mob-score">
              <span className={`proj-mob-score-val ${effectiveProject.scoreClass}`}>
                {effectiveProject.score}
              </span>
              <span className="proj-mob-score-label">Trust · {effectiveProject.trustLabel}</span>
            </div>
            <div className="proj-mob-actions">
              <button
                className="proj-mob-action"
                onClick={toggleWatchlist}
                disabled={watchlistLoading || !address}
                style={watchlisted ? { color: 'var(--gold)' } : {}}
              >
                <i className={`${watchlisted ? 'ph-fill' : 'ph-bold'} ph-star`} />
                {watchlisted ? ' Saved' : ' Watch'}
              </button>
              <button
                className="proj-mob-action"
                onClick={() => setEmergencyOpen(true)}
                style={emergencyCall?.status === 'active' ? { color: '#e07070' } : {}}
              >
                <i className="ph-bold ph-warning" />
                {emergencyCall?.status === 'active' ? ' Alert!' : ' Emergency'}
              </button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            {tabsCanLeft && (
              <button
                className="proj-tab-arrow"
                onClick={() => { tabsRef.current?.scrollBy({ left: -120, behavior: 'smooth' }); setTimeout(updateTabsArrows, 200) }}
                style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 2,
                  width: 28, background: 'linear-gradient(to right, var(--surface) 60%, transparent)',
                  border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex',
                  alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 4,
                }}
              >
                <i className="ph-bold ph-caret-left" style={{ fontSize: 11 }} />
              </button>
            )}

            <div
              className="tabs trust-tabs"
              ref={tabsRef}
              onScroll={updateTabsArrows}
              style={tabsCanLeft ? { paddingLeft: 24 } : {}}
            >
              {TABS.map(t => (
                <div
                  key={t.id}
                  className={`tab${activeTab === t.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </div>
              ))}
            </div>

            {tabsCanRight && (
              <button
                className="proj-tab-arrow"
                onClick={() => { tabsRef.current?.scrollBy({ left: 120, behavior: 'smooth' }); setTimeout(updateTabsArrows, 200) }}
                style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 2,
                  width: 36, background: 'linear-gradient(to left, var(--surface) 60%, transparent)',
                  border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex',
                  alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                }}
              >
                <i className="ph-bold ph-caret-right" style={{ fontSize: 11 }} />
              </button>
            )}
          </div>
        </div>

        <div className="scroll" style={{ padding: '16px 20px', flex: 1, overflow: 'auto' }}>
          {/* Posts — feed card style */}
          {activeTab === 'posts' && (
            <div>
              {loadingPosts && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 12 }}>Loading posts…</div>
              )}
              {!loadingPosts && posts.length === 0 && (
                <div className="ui-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px', gap: 12, textAlign: 'center' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className="ph-bold ph-newspaper" style={{ fontSize: 22, color: 'var(--muted2)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>
                      {isAdmin ? 'No posts yet' : 'Nothing here yet'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 260 }}>
                      {isAdmin
                        ? 'Post a milestone or update to start building community trust and improve your Trust Score'
                        : 'This project hasn\'t posted any updates yet. Check back soon.'}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setCreateOpen(true)}
                      style={{
                        marginTop: 4, padding: '11px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)',
                        color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'background 0.15s',
                      }}
                    >
                      <i className="ph-bold ph-plus" style={{ marginRight: 6 }} />
                      Post first update
                    </button>
                  )}
                </div>
              )}
              <div className="feed-posts-grid" style={{ gridTemplateColumns: '1fr' }}>
                {posts.map((post, i) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={i}
                    onClick={() => { setScrollToComments(false); setSelectedPost(post) }}
                    onCommentClick={() => { setScrollToComments(true); setSelectedPost(post) }}
                    onVoteFinalized={refreshTrustScore}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'overview' && <OverviewTab project={effectiveProject} verdictCount={votingPosts.length} holderCount={holderCount} />}
          {activeTab === 'roadmap'  && <RoadmapTab milestones={milestones} loading={milestonesLoading} />}
          {activeTab === 'timeline' && <TimelineTab history={trustHistory} />}
          {activeTab === 'votes'    && <VotesTab    posts={votingPosts} loading={votingLoading} />}
          {activeTab === 'holders'  && <HoldersTab tokenAddress={tokenAddress} slug={slug ?? ''} address={address} />}

          {/* Analytics tab — admin only */}
          {activeTab === 'analytics' && isAdmin && (
            <AnalyticsTab data={analyticsData} loading={analyticsLoading} />
          )}

          {/* Settings tab — admin only */}
          {activeTab === 'settings' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Profile info */}
              <div style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted2)', fontWeight: 600 }}>
                  <i className="ph-bold ph-buildings" style={{ marginRight: 6 }} />Project Profile
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="create-field" style={{ marginBottom: 0 }}>
                    <label className="create-label">PROJECT NAME</label>
                    <input className="create-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Project name" />
                  </div>
                  <div className="create-field" style={{ marginBottom: 0 }}>
                    <label className="create-label">DESCRIPTION</label>
                    <textarea className="create-textarea" rows={3} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Describe your project…" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">CATEGORY</label>
                      <input className="create-input" value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="AMM, DEX, Lending…" />
                    </div>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">AVATAR</label>
                      <input
                        ref={avatarFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {editAvatarUrl ? (
                          <img src={editAvatarUrl} alt="avatar"
                            style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '0.5px solid var(--border2)' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="ph-bold ph-image" style={{ color: 'var(--muted2)', fontSize: 16 }} />
                          </div>
                        )}
                        <button
                          type="button"
                          className="action-btn"
                          style={{ fontSize: 11, padding: '5px 10px', opacity: uploadingAvatar ? 0.6 : 1 }}
                          disabled={uploadingAvatar}
                          onClick={() => avatarFileRef.current?.click()}
                        >
                          {uploadingAvatar ? 'Uploading…' : 'Change'}
                        </button>
                        {avatarUploadMsg && (
                          <span style={{ fontSize: 11, color: avatarUploadMsg.includes('fail') || avatarUploadMsg.includes('fail') ? 'var(--red)' : 'var(--green)' }}>
                            {avatarUploadMsg}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Token contract */}
              {editHasToken && (
                <div style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted2)', fontWeight: 600 }}>
                    <i className="ph-bold ph-coin" style={{ marginRight: 6 }} />Token Contract
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">CONTRACT ADDRESS (BASE MAINNET)</label>
                      <input
                        className="create-input"
                        value={editTokenAddress}
                        onChange={e => setEditTokenAddress(e.target.value)}
                        placeholder="0x…"
                        style={{ fontFamily: 'monospace', fontSize: 12 }}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 5 }}>
                      Shown on the Holders tab so users can verify their holding on Basescan.
                    </div>
                  </div>
                </div>
              )}

              {/* Social links */}
              <div style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted2)', fontWeight: 600 }}>
                  <i className="ph-bold ph-link" style={{ marginRight: 6 }} />Links &amp; Social
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'WEBSITE', value: editWebsite, setter: setEditWebsite, icon: 'ph-globe', placeholder: 'https://yourproject.xyz' },
                    { label: 'WHITEPAPER', value: editWhitepaper, setter: setEditWhitepaper, icon: 'ph-file-text', placeholder: 'https://docs.yourproject.xyz' },
                    { label: 'GITHUB', value: editGithub, setter: setEditGithub, icon: 'ph-github-logo', placeholder: 'https://github.com/yourproject' },
                    { label: 'X / TWITTER', value: editTwitter, setter: setEditTwitter, icon: 'ph-x-logo', placeholder: 'https://x.com/yourproject' },
                    { label: 'DISCORD', value: editDiscord, setter: setEditDiscord, icon: 'ph-discord-logo', placeholder: 'https://discord.gg/invite' },
                  ].map(({ label, value, setter, icon, placeholder }) => (
                    <div key={label} className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className={`ph-bold ${icon}`} style={{ fontSize: 10 }} />{label}
                      </label>
                      <input className="create-input" value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted2)', fontWeight: 600 }}>
                  <i className="ph-bold ph-eye" style={{ marginRight: 6 }} />Tab Visibility
                </div>
                <div style={{ padding: '4px 0' }}>
                  {[
                    {
                      label: 'Project has a token',
                      desc: 'Enabling forces Holders tab to always be visible',
                      checked: editHasToken,
                      onChange: () => { const next = !editHasToken; setEditHasToken(next); if (next) setEditShowHolders(true) },
                      disabled: false,
                    },
                    {
                      label: 'Show Holders tab',
                      desc: editHasToken ? 'Locked — project has a token' : undefined,
                      checked: editShowHolders,
                      onChange: () => setEditShowHolders(v => !v),
                      disabled: editHasToken,
                    },
                    {
                      label: 'Show Votes tab',
                      desc: 'Community proposals & voting',
                      checked: editShowVotes,
                      onChange: () => setEditShowVotes(v => !v),
                      disabled: false,
                    },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.04)', opacity: item.disabled ? 0.5 : 1 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{item.label}</div>
                        {item.desc && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{item.desc}</div>}
                      </div>
                      <BlueToggle checked={item.checked} onChange={item.onChange} disabled={item.disabled} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Roadmap management */}
              <div style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted2)', fontWeight: 600 }}>
                  <i className="ph-bold ph-map-trifold" style={{ marginRight: 6 }} />Roadmap
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Existing milestones */}
                  {milestones.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
                      {milestones.map(m => {
                        const isLocked = m.status === 'pending_confirmation' || m.status === 'completed' || m.status === 'disputed' || m.status === 'missed'
                        const statusColor =
                          m.status === 'completed'            ? 'var(--green)'  :
                          m.status === 'in_progress'          ? '#6f9be5'       :
                          m.status === 'pending_confirmation' ? '#c9a55a'       :
                          m.status === 'disputed'             ? 'var(--red)'    :
                          m.status === 'missed'               ? 'var(--red)'    : 'var(--muted2)'
                        const statusLabel =
                          m.status === 'completed'            ? '✓ Done'        :
                          m.status === 'in_progress'          ? '◉ Active'      :
                          m.status === 'pending_confirmation' ? '⏳ Voting…'    :
                          m.status === 'disputed'             ? '✕ Rejected'    :
                          m.status === 'missed'               ? '✕ Missed'      : '○ Planned'
                        return (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,0.02)', border: `0.5px solid ${m.status === 'pending_confirmation' ? 'rgba(201,165,90,0.25)' : m.status === 'disputed' ? 'rgba(224,112,112,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>Q{m.quarter} {m.year}</span>
                              <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{m.title}</span>
                            </div>
                            {/* Status label — clickable toggle only for upcoming/in_progress */}
                            {!isLocked ? (
                              <button onClick={() => toggleMilestoneStatus(m)} title="Toggle status"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 600, fontFamily: 'inherit', color: statusColor }}>
                                {statusLabel}
                              </button>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, padding: '2px 6px' }}>{statusLabel}</span>
                            )}
                            {/* Submit for community confirmation — in_progress, or resubmit after a rejected/missed vote */}
                            {(m.status === 'in_progress' || m.status === 'disputed' || m.status === 'missed') && (
                              <button
                                onClick={() => submitForConfirmation(m)}
                                title={m.status === 'in_progress' ? 'Submit for community confirmation' : 'Resubmit for community confirmation'}
                                style={{ background: 'rgba(201,165,90,0.1)', border: '0.5px solid rgba(201,165,90,0.35)', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', fontSize: 10, fontWeight: 600, color: '#c9a55a', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                <i className={`ph-bold ${m.status === 'in_progress' ? 'ph-users' : 'ph-arrow-counter-clockwise'}`} style={{ marginRight: 4 }} />
                                {m.status === 'in_progress' ? 'Confirm' : 'Resubmit'}
                              </button>
                            )}
                            {/* Delete — not allowed when pending or completed */}
                            {!isLocked && (
                              <button onClick={() => deleteMilestone(m.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted2)', fontSize: 12, lineHeight: 1 }}
                                title="Delete">
                                <i className="ph-bold ph-x" style={{ fontSize: 10 }} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Add new milestone */}
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 60px 1fr', gap: 8 }}>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">YEAR</label>
                      <input className="create-input" type="number" value={newMs.year} onChange={e => setNewMs(p => ({ ...p, year: +e.target.value }))} />
                    </div>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">Q</label>
                      <select className="create-select" value={newMs.quarter} onChange={e => setNewMs(p => ({ ...p, quarter: +e.target.value }))}>
                        <option value={1}>Q1</option><option value={2}>Q2</option>
                        <option value={3}>Q3</option><option value={4}>Q4</option>
                      </select>
                    </div>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">TITLE</label>
                      <input className="create-input" value={newMs.title} onChange={e => setNewMs(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Mainnet launch" />
                    </div>
                  </div>
                  <div className="create-field" style={{ marginBottom: 0 }}>
                    <label className="create-label">DESCRIPTION (OPTIONAL)</label>
                    <input className="create-input" value={newMs.description} onChange={e => setNewMs(p => ({ ...p, description: e.target.value }))} placeholder="Short details…" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select className="create-select" value={newMs.status} onChange={e => setNewMs(p => ({ ...p, status: e.target.value as Milestone['status'] }))} style={{ flex: 1 }}>
                      <option value="upcoming">Planned</option>
                      <option value="in_progress">In progress</option>
                    </select>
                    <button onClick={addMilestone} disabled={addingMs || !newMs.title.trim()}
                      style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid rgba(111,155,229,0.35)', background: 'rgba(111,155,229,0.1)', color: '#6f9be5', fontSize: 12, fontWeight: 600, cursor: addingMs ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: addingMs ? 0.6 : 1 }}>
                      <i className="ph-bold ph-plus" style={{ marginRight: 5 }} />Add
                    </button>
                  </div>
                  {msError && <div style={{ fontSize: 11, color: 'var(--red)' }}>{msError}</div>}
                </div>
              </div>

              {/* Save */}
              {saveMsg && (
                <div style={{ fontSize: 12, color: saveMsg === 'Saved!' ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className={`ph-bold ${saveMsg === 'Saved!' ? 'ph-check-circle' : 'ph-warning-circle'}`} /> {saveMsg}
                </div>
              )}
              <button
                onClick={saveProject}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '11px 20px', borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer',
                  background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.18)',
                  color: 'var(--text)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  opacity: saving ? 0.6 : 1, transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.11)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)' }}
              >
                {saving
                  ? <><span className="spin"><i className="ph-bold ph-circle-notch" /></span> Saving…</>
                  : <><i className="ph-bold ph-floppy-disk" /> Save Changes</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {emergencyOpen && projectDbId && (
        <EmergencyCallModal
          call={emergencyCall}
          projectId={projectDbId}
          wallet={address}
          config={emergencyConfig}
          isAdmin={isAdmin}
          phase={emergencyPhase}
          verdict={emergencyVerdict}
          responded={emergencyResponded}
          onClose={() => setEmergencyOpen(false)}
          onUpdated={c => setEmergencyCall(c)}
          onReload={reloadEmergency}
        />
      )}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => { setSelectedPost(null); setScrollToComments(false) }}
          scrollToComments={scrollToComments}
        />
      )}
      {createOpen && address && isAdmin && (
        <CreatePostModal
          onClose={() => setCreateOpen(false)}
          walletAddress={address}
          projectName={effectiveProject.name}
          onPublish={post => { setPosts(prev => [post, ...prev]); setCreateOpen(false) }}
        />
      )}

      <div className="right" id="project-detail-right">
        <TrustScore
          score={effectiveProject.score}
          label={effectiveProject.trustLabel}
          trend={
            monthlyDelta === null ? '—' :
            monthlyDelta > 0     ? `+${monthlyDelta} pts` :
            monthlyDelta < 0     ? `${monthlyDelta} pts` :
            'No change'
          }
          trendClass={
            monthlyDelta === null || monthlyDelta === 0 ? 'plt-na' :
            monthlyDelta > 0                            ? 'plt-up' : 'plt-down'
          }
        />
        <div className="panel">
          <div className="panel-title">Stats</div>
          {holderCount !== null && holderCount > 0 && (
            <div className="s-row"><span className="s-k">Verified holders</span><span className="s-v green">{holderCount}</span></div>
          )}
          <div className="s-row"><span className="s-k">Verdicts</span><span className="s-v">{votingPosts.length}</span></div>
          <div className="s-row"><span className="s-k">Active since</span><span className="s-v">{effectiveProject.activeSince}</span></div>
          <div className="s-row"><span className="s-k">Category</span><span className="s-v">{effectiveProject.cat.split(' · ')[0]}</span></div>
        </div>
        <div className="panel">
          <div className="panel-title">Actions</div>
          {tokenAddress && (
            <button className="action-btn" onClick={() => setActiveTab('holders')}>
              <i className="ph-bold ph-shield-check" /> Verify holding
            </button>
          )}
          <button
            className="action-btn"
            onClick={toggleWatchlist}
            disabled={watchlistLoading || !address}
            style={watchlisted
              ? { color: 'var(--gold)', borderColor: 'rgba(201,165,90,0.35)', background: 'rgba(201,165,90,0.06)' }
              : {}}
          >
            <i className={`${watchlisted ? 'ph-fill' : 'ph-bold'} ph-star`} />
            {watchlistLoading ? ' …' : watchlisted ? ' Watchlisted' : ' Add to watchlist'}
          </button>
        </div>

        {/* Emergency Call card */}
        <div
          className={`em-card${emergencyCall?.status === 'active' ? ' em-active' : ''}`}
          onClick={() => setEmergencyOpen(true)}
        >
          <div className="em-card-inner">
            <div className="em-card-head">
              <i className={`ph-bold ph-warning em-icon${emergencyCall?.status ? ' em-icon-pulse' : ''}`} />
              <span className="em-title">Emergency Call</span>
              {emergencyCall?.status === 'collecting' && (
                <span className="em-badge em-badge-live">Live</span>
              )}
              {emergencyCall?.status === 'active' && emergencyPhase === 'voting' && (
                <span className="em-badge em-badge-active">Voting</span>
              )}
              {emergencyCall?.status === 'active' && emergencyPhase !== 'voting' && (
                <span className="em-badge em-badge-active">Active</span>
              )}
            </div>

            {!emergencyCall && (
              <div className="em-desc">
                Raise a community alarm if this project shows signs of a rug or major breach of trust
              </div>
            )}

            {emergencyCall?.status === 'collecting' && (
              <div className="em-progress-wrap">
                <div className="em-progress-bar">
                  <div className="em-progress-fill" style={{ width: `${Math.min(100, Math.round((emergencyCall.pool_zxp / emergencyConfig.pool_goal) * 100))}%` }} />
                </div>
                <div className="em-progress-meta">
                  <span>{emergencyCall.pool_zxp} / {emergencyConfig.pool_goal} ZXP</span>
                  <span>{emergencyCall.participant_count} wallet{emergencyCall.participant_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )}

            {emergencyCall?.status === 'active' && emergencyPhase === 'voting' && (
              <div className="em-active-row">
                <i className="ph-bold ph-scales" style={{ fontSize: 11 }} />
                Community is deciding the verdict
              </div>
            )}
            {emergencyCall?.status === 'active' && emergencyPhase !== 'voting' && (
              <div className="em-active-row">
                <i className="ph-bold ph-clock" style={{ fontSize: 11 }} />
                Project has 48h to respond
              </div>
            )}
          </div>
        </div>
        {effectiveProject.verifiers.length > 0 && (
          <div className="panel">
            <div className="panel-title">Top verifiers</div>
            {effectiveProject.verifiers.map((v, i) => (
              <div key={i} className="tv-row">
                <div className="tv-av">{v.letter}</div>
                <div className="tv-name">{v.address}</div>
                <div className="tv-pts">{v.pts}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
