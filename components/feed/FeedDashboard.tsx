'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import type { FeedPost } from '@/lib/feedData'
import OnboardingWidget from './OnboardingWidget'
import CheckInModal from './CheckInModal'
import { localDateStr } from '@/lib/localDate'

interface Props {
  posts: FeedPost[]
  onNavigate?: (page: string) => void
  onOpenPost?: (post: FeedPost) => void
}

interface PopularProject { name: string; slug: string; avatar_url?: string | null; likes: number }
interface WatchProject   { name: string; slug: string; avatar_url?: string | null; trust_score: number | null }
interface TodayStats     { posts_today: number; projects_total: number; zxp_today: number; users_today: number }

function Avatar({ letter, avatarUrl, variant }: { letter: string; avatarUrl?: string | null; variant: 'gold' | 'muted' }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={letter}
        style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return <span className={`fd-avatar fd-avatar-${variant}`}>{letter}</span>
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

function SkelRows({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skel skel-fd-row" style={{ animationDelay: `${i * 0.07}s` }} />
      ))}
    </>
  )
}

export default function FeedDashboard({ posts, onNavigate, onOpenPost }: Props) {
  const { address } = useAppKitAccount()
  const [popular,        setPopular]        = useState<PopularProject[]>([])
  const [watchlist,      setWatchlist]      = useState<WatchProject[]>([])
  const [stats,          setStats]          = useState<TodayStats | null>(null)
  const [checkedIn,      setCheckedIn]      = useState(false)
  const [claimZxp,       setClaimZxp]      = useState(0)
  const [claimStreak,    setClaimStreak]    = useState(0)
  const [checkInOpen,    setCheckInOpen]    = useState(false)
  const [loadingPopular, setLoadingPopular] = useState(true)
  const [loadingStats,   setLoadingStats]   = useState(true)
  const [loadingWatch,   setLoadingWatch]   = useState(false)

  useEffect(() => {
    fetch('/api/projects/popular')
      .then(r => r.json())
      .then(({ projects }) => setPopular(projects ?? []))
      .catch(() => {})
      .finally(() => setLoadingPopular(false))
  }, [])

  useEffect(() => {
    fetch('/api/stats/today')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoadingStats(false))
  }, [])

  useEffect(() => {
    if (!address) { setWatchlist([]); setLoadingWatch(false); return }
    setLoadingWatch(true)
    fetch(`/api/watchlist?wallet=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then(({ items }: { items: { projects: WatchProject | null }[] }) =>
        setWatchlist((items ?? []).map(i => i.projects).filter(Boolean) as WatchProject[]))
      .catch(() => {})
      .finally(() => setLoadingWatch(false))
  }, [address])

  const fetchCheckin = useCallback((addr: string) => {
    fetch(`/api/zxp/claim?wallet=${encodeURIComponent(addr)}&date=${localDateStr()}`)
      .then(r => r.json())
      .then(({ checked_in, zxp_earned, streak_day }) => {
        setCheckedIn(!!checked_in)
        if (zxp_earned) setClaimZxp(zxp_earned)
        if (streak_day) setClaimStreak(streak_day)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!address) { setCheckedIn(false); setClaimZxp(0); setClaimStreak(0); return }
    fetchCheckin(address)
  }, [address, fetchCheckin])

  const handleClaimed = () => {
    if (address) fetchCheckin(address)
  }

  // Latest proposal — prefer an open vote so it's actionable, else newest voting/verdict
  const latestProposal =
    posts.find(p => p.type === 'voting' && p.vote?.open) ||
    posts.find(p => p.type === 'voting') ||
    posts.find(p => p.type === 'verdict')
  const proposalVotable = latestProposal?.type === 'voting'

  // Real trust score movers from loaded posts
  const movers = Object.values(
    posts
      .filter(p => p.trustScoreChange && p.trustScoreChange !== 0)
      .reduce<Record<string, { name: string; delta: number }>>((acc, p) => {
        if (!acc[p.project]) acc[p.project] = { name: p.project, delta: 0 }
        acc[p.project].delta += p.trustScoreChange!
        return acc
      }, {})
  )
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)

  return (
    <div className="feed-dashboard">

      {/* ── Latest Proposal (tap to open & vote) ──────────── */}
      {latestProposal && (
        <div
          className="fd-section"
          role="button"
          tabIndex={0}
          onClick={() => onOpenPost?.(latestProposal)}
          onKeyDown={e => { if (e.key === 'Enter') onOpenPost?.(latestProposal) }}
          title={proposalVotable ? 'Open proposal to vote' : 'Open proposal'}
          style={{ cursor: 'pointer' }}
        >
          <div className="fd-section-header">
            <span className="fd-section-title" style={{ marginBottom: 0 }}>Latest Proposal</span>
            <span style={{
              fontSize: 9, letterSpacing: '0.5px',
              color: proposalVotable ? 'var(--gold)' : 'var(--muted2)',
              textTransform: 'uppercase', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              {proposalVotable ? <>Vote <i className="ph-bold ph-arrow-right" /></> : <>View <i className="ph-bold ph-arrow-right" /></>}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: '6px 0 8px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {latestProposal.title || latestProposal.text.slice(0, 48)}
          </div>
          {latestProposal.vote && (
            <>
              <div className="fd-vote-track">
                <div className="fd-vote-yes" style={{ width: `${latestProposal.vote.yes}%` }} />
                <div className="fd-vote-no" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6 }}>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>{latestProposal.vote.yes}% Yes</span>
                <span style={{ color: 'var(--muted)' }}>{latestProposal.vote.count} votes</span>
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>{100 - latestProposal.vote.yes}% No</span>
              </div>
            </>
          )}
          {!latestProposal.vote && (
            <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
              {latestProposal.project} · {latestProposal.type}
            </div>
          )}
        </div>
      )}

      {/* ── No active proposals (placeholder) ──────── */}
      {!latestProposal && (
        <div className="fd-section">
          <div className="fd-section-header">
            <span className="fd-section-title" style={{ marginBottom: 0 }}>Latest Proposal</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', padding: '6px 0 2px' }}>
            No active proposals
          </div>
        </div>
      )}

      {/* ── Trust Score Movers ───────────────────── */}
      <div className="fd-section">
        <div className="fd-section-title">Trust Score Movers</div>
        {movers.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted2)', padding: '3px 0' }}>No changes today</div>
        ) : movers.map((m, i) => (
          <div key={i} className="fd-row">
            <span className="fd-row-name">{m.name}</span>
            <span style={{ color: m.delta > 0 ? 'var(--green)' : 'var(--red)',
              fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
              {m.delta > 0 ? '+' : ''}{m.delta}
            </span>
          </div>
        ))}
      </div>

      {/* ── Platform Today ───────────────────────── */}
      <div className="fd-section">
        <div className="fd-section-title">Platform Today</div>
        <div className={`fd-stat-grid${!loadingStats && stats ? ' ui-fade-in' : ''}`}>
          <div className="fd-stat-tile">
            <div className="fd-stat-val" style={{ color: 'var(--green)' }}>
              {stats ? fmt(stats.posts_today) : '—'}
            </div>
            <div className="fd-stat-lbl">Posts</div>
          </div>
          <div className="fd-stat-tile">
            <div className="fd-stat-val">
              {stats ? fmt(stats.users_today) : '—'}
            </div>
            <div className="fd-stat-lbl">Active Users</div>
          </div>
          <div className="fd-stat-tile">
            <div className="fd-stat-val" style={{ color: 'var(--gold)' }}>
              {stats ? (stats.zxp_today > 0 ? '+' + fmt(stats.zxp_today) : '0') : '—'}
            </div>
            <div className="fd-stat-lbl">ZXP</div>
          </div>
          <div className="fd-stat-tile">
            <div className="fd-stat-val">
              {stats ? fmt(stats.projects_total) : '—'}
            </div>
            <div className="fd-stat-lbl">Projects</div>
          </div>
        </div>

        {/* Daily Check-in */}
        {address && (
          <div data-tour="checkin" style={{ marginTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
            {checkedIn ? (
              <div
                onClick={() => setCheckInOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  background: 'rgba(101,191,127,0.07)', border: '0.5px solid rgba(101,191,127,0.2)',
                  borderRadius: 8, fontSize: 12, cursor: 'pointer',
                }}
              >
                <i className="ph-bold ph-calendar-check" style={{ color: 'var(--green)', fontSize: 14 }} />
                <span style={{ flex: 1, color: 'var(--text)' }}>
                  Checked in · Day <strong>{claimStreak}</strong>
                </span>
                <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 11 }}>+{claimZxp} ZXP</span>
              </div>
            ) : (
              <button
                onClick={() => setCheckInOpen(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(201,165,90,0.08)', border: '0.5px solid rgba(201,165,90,0.3)',
                  color: 'var(--gold)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
              >
                <i className="ph-bold ph-calendar" style={{ fontSize: 13 }} /> Daily Check-in · +1 ZXP
              </button>
            )}
          </div>
        )}
        {checkInOpen && (
          <CheckInModal
            onClose={() => setCheckInOpen(false)}
            onClaimed={handleClaimed}
          />
        )}
      </div>

      {/* ── Onboarding Widget ────────────────────── */}
      <OnboardingWidget />

      {/* ── Popular Projects ─────────────────────── */}
      <div className="fd-section">
        <div className="fd-section-title">Popular Projects</div>
        {loadingPopular ? (
          <SkelRows count={4} />
        ) : popular.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted2)', padding: '3px 0' }}>No data yet</div>
        ) : (
          <div className="ui-fade-in">
            {popular.map((p, i) => (
              <div key={p.slug || i} className="fd-row">
                <Avatar letter={p.name[0]?.toUpperCase() ?? '?'} avatarUrl={p.avatar_url} variant="gold" />
                <span className="fd-row-name">
                  {p.slug
                    ? <a href={`/projects/${p.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{p.name}</a>
                    : p.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <i className="ph-fill ph-heart" style={{ fontSize: 8, color: 'var(--red)' }} />
                  {p.likes}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── My Watchlist ─────────────────────────── */}
      {address && (
        <div className="fd-section">
          <div className="fd-section-title">My Watchlist</div>
          {loadingWatch ? (
            <SkelRows count={3} />
          ) : watchlist.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted2)', padding: '3px 0' }}>No projects added</div>
          ) : (
            <div className="ui-fade-in">
              {watchlist.slice(0, 5).map((p, i) => (
                <div key={p.slug || i} className="fd-row">
                  <Avatar letter={p.name[0]?.toUpperCase() ?? '?'} avatarUrl={p.avatar_url} variant="muted" />
                  <span className="fd-row-name">
                    {p.slug
                      ? <a href={`/projects/${p.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{p.name}</a>
                      : p.name}
                  </span>
                  {p.trust_score != null && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                      color: p.trust_score >= 70 ? 'var(--green)' : p.trust_score >= 50 ? 'var(--gold)' : 'var(--red)',
                    }}>
                      {p.trust_score}
                    </span>
                  )}
                </div>
              ))}
              {watchlist.length > 5 && (
                <button
                  onClick={() => onNavigate?.('profile')}
                  style={{
                    marginTop: 8, width: '100%', padding: '6px 0',
                    background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)',
                    borderRadius: 7, fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
                    letterSpacing: '0.5px',
                  }}
                >
                  See all ({watchlist.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div style={{
        fontSize: 10, color: 'rgba(255,255,255,0.18)', textAlign: 'center',
        padding: '6px 0 2px', letterSpacing: '0.5px', flexShrink: 0,
      }}>
        © 2026 Zexus Protocol
      </div>
    </div>
  )
}
