'use client'

import { useState, useEffect } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import type { FeedPost } from '@/lib/feedData'

interface Props { posts: FeedPost[] }

interface PopularProject { name: string; slug: string; likes: number }
interface WatchProject   { name: string; slug: string; trust_score: number | null }
interface TodayStats     { posts_today: number; projects_total: number; zxp_today: number; users_today: number }

function Avatar({ letter, variant }: { letter: string; variant: 'gold' | 'muted' }) {
  return <span className={`fd-avatar fd-avatar-${variant}`}>{letter}</span>
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

export default function FeedDashboard({ posts }: Props) {
  const { address } = useAppKitAccount()
  const [popular,   setPopular]   = useState<PopularProject[]>([])
  const [watchlist, setWatchlist] = useState<WatchProject[]>([])
  const [stats,     setStats]     = useState<TodayStats | null>(null)

  useEffect(() => {
    fetch('/api/projects/popular')
      .then(r => r.json()).then(({ projects }) => setPopular(projects ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/stats/today')
      .then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    if (!address) { setWatchlist([]); return }
    fetch(`/api/watchlist?wallet=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then(({ items }: { items: { projects: WatchProject | null }[] }) =>
        setWatchlist((items ?? []).map(i => i.projects).filter(Boolean) as WatchProject[]))
      .catch(() => {})
  }, [address])

  // Latest proposal (voting or verdict type)
  const latestProposal = posts.find(p => p.type === 'voting' || p.type === 'verdict')

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

      {/* ── Latest Proposal (read-only) ──────────── */}
      {latestProposal && (
        <div className="fd-section">
          <div className="fd-section-header">
            <span className="fd-section-title" style={{ marginBottom: 0 }}>Latest Proposal</span>
            <span style={{
              fontSize: 9, letterSpacing: '1px', color: 'var(--muted2)',
              textTransform: 'uppercase', fontWeight: 600,
            }}>
              read only
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
        <div className="fd-stat-grid">
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
      </div>

      {/* ── Popular Projects ─────────────────────── */}
      <div className="fd-section">
        <div className="fd-section-title">Popular Projects</div>
        {popular.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted2)', padding: '3px 0' }}>No data yet</div>
        ) : popular.map((p, i) => (
          <div key={p.slug || i} className="fd-row">
            <Avatar letter={p.name[0]?.toUpperCase() ?? '?'} variant="gold" />
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

      {/* ── My Watchlist ─────────────────────────── */}
      {address && (
        <div className="fd-section" style={{ flex: 1 }}>
          <div className="fd-section-title">My Watchlist</div>
          {watchlist.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted2)', padding: '3px 0' }}>No projects added</div>
          ) : watchlist.map((p, i) => (
            <div key={p.slug || i} className="fd-row">
              <Avatar letter={p.name[0]?.toUpperCase() ?? '?'} variant="muted" />
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
        </div>
      )}
    </div>
  )
}
