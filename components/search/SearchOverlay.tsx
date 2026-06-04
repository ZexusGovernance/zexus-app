'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Project {
  id: string
  name: string
  slug: string
  category: string | null
  description: string | null
  trust_score: number
  is_verified: boolean
  has_admin: boolean
  avatar_url: string | null
}

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (page: string) => void
  walletAddress?: string | null
  adminProjectSlug?: string | null
}

const AV_COLORS = ['av-blue', 'av-teal', 'av-purple', 'av-gold', 'av-red', 'av-green']

function avatarColor(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h += slug.charCodeAt(i)
  return AV_COLORS[h % AV_COLORS.length]
}

function scoreColor(n: number) {
  if (n >= 70) return 'var(--green)'
  if (n >= 45) return '#e0b860'
  return 'var(--red)'
}

// Sort logic for default (empty query) view:
// 1. User's own project (if admin)
// 2. Active projects (has_admin + is_verified) — top by trust_score
// 3. Active projects (has_admin only)
// 4. Verified only
// 5. Rest
function sortedDefault(projects: Project[], adminSlug: string | null | undefined): Project[] {
  const seen = new Set<string>()
  const out: Project[] = []

  const push = (p: Project) => { if (!seen.has(p.id)) { seen.add(p.id); out.push(p) } }

  if (adminSlug) {
    const own = projects.find(p => p.slug === adminSlug)
    if (own) push(own)
  }

  // Active + verified (most trustworthy)
  projects.filter(p => p.has_admin && p.is_verified).forEach(push)
  // Active only
  projects.filter(p => p.has_admin && !p.is_verified).forEach(push)
  // Verified only
  projects.filter(p => !p.has_admin && p.is_verified).forEach(push)
  // Rest
  projects.filter(p => !p.has_admin && !p.is_verified).forEach(push)

  return out
}

function sectionLabel(p: Project, adminSlug: string | null | undefined): string {
  if (adminSlug && p.slug === adminSlug) return 'Your Project'
  if (p.has_admin && p.is_verified) return 'Active'
  if (p.has_admin) return 'Active'
  if (p.is_verified) return 'Verified'
  return ''
}

export default function SearchOverlay({
  isOpen, onClose, adminProjectSlug,
}: SearchOverlayProps) {
  const [query,    setQuery]    = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(false)
  const [cursor,   setCursor]   = useState(-1)
  const inputRef   = useRef<HTMLInputElement>(null)
  const fetchedRef = useRef(false)
  const router     = useRouter()

  useEffect(() => {
    if (isOpen && !fetchedRef.current) {
      fetchedRef.current = true
      setLoading(true)
      fetch('/api/projects')
        .then(r => r.json())
        .then((d: { projects?: Project[] }) => setProjects(d.projects ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setCursor(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const q = query.trim().toLowerCase()

  const filtered: Project[] = q
    ? projects
        .filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q),
        )
        .slice(0, 8)
    : sortedDefault(projects, adminProjectSlug).slice(0, 6)

  function goTo(slug: string) {
    onClose()
    router.push(`/projects/${slug}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, -1))
    } else if (e.key === 'Enter' && cursor >= 0 && filtered[cursor]) {
      goTo(filtered[cursor].slug)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8,7,6,0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 72,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 500, maxWidth: 'calc(100vw - 24px)',
          background: 'var(--bg)',
          border: '0.5px solid var(--border2)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.4), 0 20px 60px rgba(0,0,0,0.7)',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          borderBottom: '0.5px solid var(--border)',
        }}>
          <i
            className="ph-bold ph-magnifying-glass"
            style={{ fontSize: 15, color: 'var(--muted)', flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 14, color: 'var(--text)', fontFamily: 'inherit',
            }}
            placeholder="Search projects…"
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(-1) }}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setCursor(-1); inputRef.current?.focus() }}
              style={{
                background: 'none', border: 'none',
                color: 'var(--muted2)', cursor: 'pointer',
                padding: '2px 5px', fontSize: 12, flexShrink: 0,
              }}
            >
              <i className="ph-bold ph-x" />
            </button>
          )}
          <kbd
            onClick={onClose}
            style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 5,
              border: '0.5px solid var(--border2)', color: 'var(--muted2)',
              background: 'rgba(255,255,255,0.03)', cursor: 'pointer', flexShrink: 0,
              fontFamily: 'inherit',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--muted2)', fontSize: 12 }}>
              <i className="ph-bold ph-circle-notch spin" style={{ fontSize: 15, display: 'block', marginBottom: 6 }} />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted2)' }}>
              <i className="ph-bold ph-magnifying-glass" style={{ fontSize: 20, display: 'block', marginBottom: 8, opacity: 0.3 }} />
              No projects found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div style={{ padding: '6px 0' }}>

              {/* Section header when no query */}
              {!q && (
                <div style={{
                  fontSize: 9, letterSpacing: '1.2px', fontWeight: 700,
                  textTransform: 'uppercase', color: 'var(--muted2)',
                  padding: '4px 14px 6px',
                }}>
                  Projects
                </div>
              )}

              {filtered.map((p, i) => {
                const isActive = cursor === i
                const badge = !q ? sectionLabel(p, adminProjectSlug) : ''
                const isOwn = !!adminProjectSlug && p.slug === adminProjectSlug

                return (
                  <div
                    key={p.id}
                    onClick={() => goTo(p.slug)}
                    onMouseEnter={() => setCursor(i)}
                    onMouseLeave={() => setCursor(-1)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '9px 14px', cursor: 'pointer',
                      background: isOwn
                        ? 'rgba(111,155,229,0.05)'
                        : isActive
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                      borderLeft: isActive
                        ? '2px solid rgba(111,155,229,0.6)'
                        : isOwn
                          ? '2px solid rgba(111,155,229,0.3)'
                          : '2px solid transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Avatar */}
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={p.name}
                        style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        className={`proj-av ${avatarColor(p.slug)}`}
                        style={{ width: 34, height: 34, fontSize: 13, borderRadius: 9, flexShrink: 0 }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Name + category */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {p.name}
                        </span>
                        {p.is_verified && (
                          <i className="ph-fill ph-seal-check" style={{ fontSize: 11, color: '#6f9be5', flexShrink: 0 }} />
                        )}
                        {badge && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                            letterSpacing: '0.6px', textTransform: 'uppercase',
                            color: isOwn ? '#6f9be5' : p.has_admin ? 'var(--green)' : 'var(--muted)',
                            background: isOwn
                              ? 'rgba(111,155,229,0.1)'
                              : p.has_admin
                                ? 'rgba(83,201,146,0.1)'
                                : 'rgba(255,255,255,0.05)',
                            border: `0.5px solid ${isOwn ? 'rgba(111,155,229,0.2)' : p.has_admin ? 'rgba(83,201,146,0.2)' : 'rgba(255,255,255,0.07)'}`,
                          }}>
                            {badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                        {p.category ?? 'Base Mainnet'}
                      </div>
                    </div>

                    {/* Trust score */}
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: scoreColor(p.trust_score),
                      flexShrink: 0, minWidth: 24, textAlign: 'right',
                    }}>
                      {p.trust_score}
                    </div>

                    <i
                      className="ph-bold ph-arrow-right"
                      style={{
                        fontSize: 10,
                        color: isActive ? 'var(--muted)' : 'var(--muted2)',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div style={{
            padding: '7px 14px',
            borderTop: '0.5px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 10, color: 'var(--muted2)',
          }}>
            {[['↑↓', 'navigate'], ['↵', 'open'], ['Esc', 'close']].map(([key, label]) => (
              <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={{
                  padding: '1px 5px', border: '0.5px solid var(--border2)',
                  borderRadius: 4, fontSize: 9, fontFamily: 'inherit',
                  background: 'rgba(255,255,255,0.03)', color: 'var(--muted2)',
                }}>
                  {key}
                </kbd>
                {label}
              </span>
            ))}
            {!q && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted2)' }}>
                {projects.length} projects
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
