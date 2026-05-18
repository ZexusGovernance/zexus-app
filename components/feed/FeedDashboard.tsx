'use client'

import { useState, useEffect } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import type { FeedPost } from '@/lib/feedData'

interface Props {
  posts: FeedPost[]
}

interface PopularProject {
  name: string
  slug: string
  category: string
  likes: number
}

interface WatchProject {
  name: string
  slug: string
  category: string
  trust_score: number | null
}

const TRUST_MOVERS = [
  { name: 'Umia Protocol', delta: +12 },
  { name: 'BaseSwap Pro', delta: +5 },
  { name: 'NovaDEX',      delta: -18 },
]

function Avatar({ letter, variant }: { letter: string; variant: 'gold' | 'muted' }) {
  return (
    <span className={`fd-avatar fd-avatar-${variant}`}>{letter}</span>
  )
}

export default function FeedDashboard({ posts }: Props) {
  const { address } = useAppKitAccount()
  const [popular,  setPopular]  = useState<PopularProject[]>([])
  const [watchlist, setWatchlist] = useState<WatchProject[]>([])

  useEffect(() => {
    fetch('/api/projects/popular')
      .then(r => r.json())
      .then(({ projects }) => setPopular(projects ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!address) { setWatchlist([]); return }
    fetch(`/api/watchlist?wallet=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then(({ items }: { items: { projects: WatchProject | null }[] }) => {
        setWatchlist((items ?? []).map(i => i.projects).filter(Boolean) as WatchProject[])
      })
      .catch(() => {})
  }, [address])

  const latestAlert = posts.find(p => p.type === 'alert')

  return (
    <div className="feed-dashboard">

      {/* ── Live Alert ───────────────────────────── */}
      {latestAlert && (
        <div className="fd-section">
          <div className="fd-section-header">
            <span className="fd-section-title" style={{ marginBottom: 0 }}>Live Alert</span>
            <span className="fd-live-dot" />
          </div>
          <div className="fd-alert-card">
            <i className="ti ti-alert-octagon" style={{ color: 'var(--red)', fontSize: 14, flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {latestAlert.project}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {latestAlert.title || latestAlert.text.slice(0, 55)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Vote ──────────────────────────── */}
      <div className="fd-section">
        <div className="fd-section-title">Active Vote</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>
          Umia Security Audit
        </div>
        <div className="fd-vote-track">
          <div className="fd-vote-yes" style={{ width: '74%' }} />
          <div className="fd-vote-no" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6 }}>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>74% Yes</span>
          <span style={{ color: 'var(--muted)' }}>312 votes · 14h left</span>
          <span style={{ color: 'var(--red)', fontWeight: 600 }}>26% No</span>
        </div>
      </div>

      {/* ── Trust Score Movers ───────────────────── */}
      <div className="fd-section">
        <div className="fd-section-title">Trust Score Movers</div>
        {TRUST_MOVERS.map((m, i) => (
          <div key={i} className="fd-row">
            <span className="fd-row-name">{m.name}</span>
            <span style={{
              color: m.delta > 0 ? 'var(--green)' : 'var(--red)',
              fontWeight: 600, fontSize: 12, flexShrink: 0,
            }}>
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
            <div className="fd-stat-val" style={{ color: 'var(--green)' }}>12</div>
            <div className="fd-stat-lbl">Verdicts</div>
          </div>
          <div className="fd-stat-tile">
            <div className="fd-stat-val">2 140</div>
            <div className="fd-stat-lbl">Users</div>
          </div>
          <div className="fd-stat-tile">
            <div className="fd-stat-val" style={{ color: 'var(--gold)' }}>+210</div>
            <div className="fd-stat-lbl">ZXP</div>
          </div>
          <div className="fd-stat-tile">
            <div className="fd-stat-val">5</div>
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
              <i className="ti ti-heart-filled" style={{ fontSize: 8, color: 'var(--red)' }} />
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
