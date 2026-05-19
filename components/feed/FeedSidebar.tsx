'use client'

import { useState, useEffect } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'

interface PopularProject {
  name: string
  slug: string
  category: string
  likes: number
}

interface WatchItem {
  projects: {
    name: string
    slug: string
    category: string
    trust_score: number | null
  } | null
}

export default function FeedSidebar() {
  const { address } = useAppKitAccount()
  const [popular,   setPopular]   = useState<PopularProject[]>([])
  const [watchlist, setWatchlist] = useState<WatchItem['projects'][]>([])

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
      .then(({ items }: { items: WatchItem[] }) => {
        setWatchlist((items ?? []).map(i => i.projects).filter(Boolean) as WatchItem['projects'][])
      })
      .catch(() => {})
  }, [address])

  const validWatchlist = watchlist.filter(Boolean) as NonNullable<WatchItem['projects']>[]

  return (
    <div style={{
      background: 'linear-gradient(180deg, #0d0c09, #070605)',
      border: '0.5px solid rgba(201,165,90,0.12)',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 10px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(201,165,90,0.07)',
    }}>
      {/* Popular Projects */}
      <div style={{
        padding: '10px 13px 7px',
        borderBottom: '0.5px solid rgba(232,228,220,0.06)',
      }}>
        <div style={{
          fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'var(--muted2)', fontWeight: 600,
        }}>
          Popular Projects
        </div>
      </div>

      {popular.length === 0 ? (
        <div style={{ padding: '10px 13px', fontSize: 12, color: 'var(--muted2)' }}>
          No data yet
        </div>
      ) : popular.map((p, i) => (
        <div key={p.slug || i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 13px',
          borderBottom: i < popular.length - 1 ? '0.5px solid rgba(232,228,220,0.042)' : 'none',
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            background: 'rgba(201,165,90,0.11)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: 'var(--gold)',
          }}>
            {p.name[0]?.toUpperCase()}
          </span>
          <span style={{
            flex: 1, fontSize: 12, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {p.slug
              ? <a href={`/projects/${p.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{p.name}</a>
              : p.name}
          </span>
          <span style={{
            fontSize: 10, color: 'var(--muted2)', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            <i className="ph-fill ph-heart" style={{ fontSize: 8, color: 'var(--red)' }} />
            {p.likes}
          </span>
        </div>
      ))}

      {address && (
        <>
          <div style={{ height: '0.5px', background: 'rgba(201,165,90,0.15)', margin: '5px 0 0' }} />

          {/* My Watchlist */}
          <div style={{
            padding: '10px 13px 7px',
            borderBottom: '0.5px solid rgba(232,228,220,0.06)',
          }}>
            <div style={{
              fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase',
              color: 'var(--muted2)', fontWeight: 600,
            }}>
              My Watchlist
            </div>
          </div>

          {validWatchlist.length === 0 ? (
            <div style={{ padding: '10px 13px', fontSize: 12, color: 'var(--muted2)' }}>
              No projects added
            </div>
          ) : validWatchlist.map((p, i) => (
            <div key={p.slug || i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 13px',
              borderBottom: i < validWatchlist.length - 1 ? '0.5px solid rgba(232,228,220,0.042)' : 'none',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                background: 'rgba(255,255,255,0.055)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: 'var(--muted)',
              }}>
                {p.name[0]?.toUpperCase()}
              </span>
              <span style={{
                flex: 1, fontSize: 12, color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
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
        </>
      )}
    </div>
  )
}
