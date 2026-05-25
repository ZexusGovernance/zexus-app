'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface DbProject {
  id:          string
  name:        string
  slug:        string
  category:    string | null
  description: string | null
  trust_score: number
  is_verified: boolean
  has_admin:   boolean
  avatar_url:  string | null
  has_token:   boolean
}

const AV_COLORS = ['av-blue', 'av-teal', 'av-purple', 'av-gold', 'av-red', 'av-green']

function avatarColor(slug: string) {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) & 0xffff
  return AV_COLORS[h % AV_COLORS.length]
}

function scoreClass(n: number) {
  if (n >= 70) return 'hi'
  if (n >= 45) return 'mi'
  return 'lo'
}

function ProjectCard({ p, onClick, muted = false }: { p: DbProject; onClick: () => void; muted?: boolean }) {
  const sc     = scoreClass(p.trust_score)
  const avCol  = avatarColor(p.slug)
  const letter = p.name.charAt(0).toUpperCase()

  return (
    <div
      className="proj-list-card"
      style={{ cursor: 'pointer', opacity: muted ? 0.72 : 1 }}
      onClick={onClick}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {p.avatar_url ? (
          <img
            src={p.avatar_url}
            alt={p.name}
            style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div className={`proj-av ${avCol}`} style={{ width: 44, height: 44, fontSize: 18, borderRadius: 10 }}>
            {letter}
          </div>
        )}
        {p.has_admin && (
          <span style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--green)',
            border: '1.5px solid var(--surface)',
            display: 'block',
          }} title="Actively managed" />
        )}
      </div>

      <div className="plc-info">
        <div className="plc-name">{p.name}</div>
        <div className="plc-sub">
          {[p.category, 'Base Mainnet'].filter(Boolean).join(' · ')}
        </div>
        <div className="plc-tags">
          {p.has_admin && (
            <span className="plc-tag" style={{
              color: 'var(--green)',
              background: 'rgba(83,201,146,0.1)',
              border: '0.5px solid rgba(83,201,146,0.25)',
            }}>
              <i className="ph-bold ph-user-check" style={{ fontSize: '9px' }} /> Active
            </span>
          )}
          {p.is_verified && (
            <span className="plc-tag verified">
              <i className="ph-bold ph-check" style={{ fontSize: '9px' }} /> Verified
            </span>
          )}
          {p.category && <span className="plc-tag">{p.category}</span>}
          {p.has_token && <span className="plc-tag">Token</span>}
        </div>
      </div>

      <div className="plc-score-col">
        <div className={`plc-score ${sc}`}>{p.trust_score}</div>
        <div className="plc-trend plt-na" style={{ fontSize: 10, color: 'var(--muted2)' }}>
          Trust Score
        </div>
      </div>
    </div>
  )
}

type SortBy = 'score' | 'name'

export default function ProjectsPage() {
  const router = useRouter()
  const [projects,  setProjects]  = useState<DbProject[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('All')
  const [sortBy,    setSortBy]    = useState<SortBy>('score')
  const [dropOpen,  setDropOpen]  = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((d: { projects?: DbProject[] }) => {
        if (d.projects) setProjects(d.projects)
      })
      .finally(() => setLoading(false))
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [dropOpen])

  const catOptions = Array.from(new Set(projects.map(p => p.category ?? 'Other').filter(Boolean)))

  function applySort(list: DbProject[]) {
    return [...list].sort((a, b) =>
      sortBy === 'name' ? a.name.localeCompare(b.name) : b.trust_score - a.trust_score,
    )
  }

  const allFiltered = filter === 'All'
    ? projects
    : filter === 'Active'
      ? projects.filter(p => p.has_admin)
      : projects.filter(p => (p.category ?? 'Other') === filter)

  const showSections = filter === 'All'
  const onPlatform = applySort(allFiltered.filter(p => p.has_admin))
  const listed     = applySort(allFiltered.filter(p => !p.has_admin))
  const flatList   = applySort(allFiltered)

  const verified = projects.filter(p => p.is_verified).length
  const managed  = projects.filter(p => p.has_admin).length
  const avgScore = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.trust_score, 0) / projects.length)
    : 0
  const topThree = [...projects].sort((a, b) => b.trust_score - a.trust_score).slice(0, 3)

  const isFiltered = filter !== 'All'
  const filterLabel = isFiltered ? filter : null
  const sortLabel   = sortBy === 'name' ? 'Name A–Z' : 'Trust Score'

  return (
    <div className="page active" id="page-projects">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 }}>
            <div>
              <div className="page-title">Projects</div>
              <div className="page-sub" style={{ marginBottom: 0 }}>
                {projects.length} projects · Base Mainnet
              </div>
            </div>

            {/* ── Filter / Sort button ── */}
            <div ref={dropRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 13px', borderRadius: 9, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                  border: `0.5px solid ${dropOpen || isFiltered ? 'rgba(111,155,229,0.4)' : 'var(--border2)'}`,
                  background: dropOpen || isFiltered ? 'rgba(111,155,229,0.08)' : 'rgba(255,255,255,0.03)',
                  color: isFiltered ? '#6f9be5' : 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >
                <i className="ph-bold ph-funnel" style={{ fontSize: 12 }} />
                <span>{filterLabel ?? 'Filter'}</span>
                {filterLabel && (
                  <span
                    onClick={e => { e.stopPropagation(); setFilter('All') }}
                    style={{ marginLeft: 1, fontSize: 10, opacity: 0.7, cursor: 'pointer' }}
                  >
                    <i className="ph-bold ph-x" />
                  </span>
                )}
                <i
                  className="ph-bold ph-caret-down"
                  style={{ fontSize: 10, marginLeft: 1, opacity: 0.5, transition: 'transform 0.15s', transform: dropOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>

              {/* Dropdown */}
              {dropOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  width: 200, zIndex: 50,
                  background: 'var(--surface)',
                  border: '0.5px solid var(--border2)',
                  borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                }}>
                  {/* Sort section */}
                  <div style={{ padding: '10px 14px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--muted2)' }}>
                    Sort by
                  </div>
                  {([['score', 'Trust Score', 'ph-chart-bar'], ['name', 'Name A–Z', 'ph-sort-ascending']] as const).map(([val, label, icon]) => (
                    <div
                      key={val}
                      onClick={() => { setSortBy(val); setDropOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '8px 14px', cursor: 'pointer', fontSize: 12,
                        background: sortBy === val ? 'rgba(111,155,229,0.08)' : 'transparent',
                        color: sortBy === val ? '#6f9be5' : 'var(--text)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (sortBy !== val) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = sortBy === val ? 'rgba(111,155,229,0.08)' : 'transparent' }}
                    >
                      <i className={`ph-bold ${icon}`} style={{ fontSize: 12, width: 14, flexShrink: 0 }} />
                      {label}
                      {sortBy === val && <i className="ph-bold ph-check" style={{ marginLeft: 'auto', fontSize: 11 }} />}
                    </div>
                  ))}

                  <div style={{ height: '0.5px', background: 'var(--border)', margin: '6px 0' }} />

                  {/* Filter section */}
                  <div style={{ padding: '4px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--muted2)' }}>
                    Filter
                  </div>
                  {['All', 'Active', ...catOptions].map(opt => (
                    <div
                      key={opt}
                      onClick={() => { setFilter(opt); setDropOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '8px 14px', cursor: 'pointer', fontSize: 12,
                        background: filter === opt ? 'rgba(111,155,229,0.08)' : 'transparent',
                        color: filter === opt ? '#6f9be5' : 'var(--text)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (filter !== opt) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = filter === opt ? 'rgba(111,155,229,0.08)' : 'transparent' }}
                    >
                      <i className={`ph-bold ${opt === 'All' ? 'ph-squares-four' : opt === 'Active' ? 'ph-user-check' : 'ph-tag'}`}
                        style={{ fontSize: 11, width: 14, flexShrink: 0, color: opt === 'Active' ? 'var(--green)' : undefined }} />
                      {opt}
                      {filter === opt && <i className="ph-bold ph-check" style={{ marginLeft: 'auto', fontSize: 11 }} />}
                    </div>
                  ))}

                  <div style={{ padding: '8px 14px', borderTop: '0.5px solid var(--border)', marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted2)' }}>
                      {sortLabel}{isFiltered ? ` · ${filter}` : ''}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="scroll" id="projects-list">
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              Loading…
            </div>
          )}

          {!loading && flatList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              No projects yet
            </div>
          )}

          {!loading && (
            <>
              {/* ── On Platform section ── */}
              {showSections && onPlatform.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '4px 2px 10px',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.5px' }}>
                    <i className="ph-bold ph-user-check" style={{ marginRight: 5 }} />
                    On Platform
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                    background: 'rgba(83,201,146,0.1)', color: 'var(--green)',
                    border: '0.5px solid rgba(83,201,146,0.2)',
                  }}>
                    {onPlatform.length}
                  </span>
                  <div style={{ flex: 1, height: '0.5px', background: 'rgba(83,201,146,0.15)' }} />
                </div>
              )}

              {showSections ? (
                <>
                  {onPlatform.map(p =>
                    <ProjectCard key={p.id} p={p} onClick={() => router.push(`/projects/${p.slug}`)} />
                  )}

                  {listed.length > 0 && (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '20px 2px 10px',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.5px' }}>
                          <i className="ph-bold ph-list" style={{ marginRight: 5 }} />
                          Listed Protocols
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                          background: 'rgba(255,255,255,0.05)', color: 'var(--muted2)',
                          border: '0.5px solid var(--border)',
                        }}>
                          {listed.length}
                        </span>
                        <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 10, paddingLeft: 2 }}>
                        Trusted DeFi protocols listed for reference — not yet on Zexus
                      </div>
                      {listed.map(p =>
                        <ProjectCard key={p.id} p={p} onClick={() => router.push(`/projects/${p.slug}`)} muted />
                      )}
                    </>
                  )}
                </>
              ) : (
                flatList.map(p =>
                  <ProjectCard key={p.id} p={p} onClick={() => router.push(`/projects/${p.slug}`)} />
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="right" id="projects-right">
        <div className="panel">
          <div className="panel-title">Platform stats</div>
          <div className="s-row">
            <span className="s-k">Total projects</span>
            <span className="s-v">{projects.length}</span>
          </div>
          <div className="s-row">
            <span className="s-k">Verified</span>
            <span className="s-v green">{verified}</span>
          </div>
          <div className="s-row">
            <span className="s-k">Actively managed</span>
            <span className="s-v" style={{ color: 'var(--green)' }}>{managed}</span>
          </div>
          <div className="s-row">
            <span className="s-k">Average Trust Score</span>
            <span className="s-v" style={{ color: '#6f9be5' }}>{avgScore}</span>
          </div>
        </div>

        {topThree.length > 0 && (
          <div className="panel">
            <div className="panel-title">Top by Trust Score</div>
            {topThree.map(p => (
              <div
                key={p.id}
                className="rwatch-row"
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(`/projects/${p.slug}`)}
              >
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt={p.name}
                    style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    className={`proj-av ${avatarColor(p.slug)}`}
                    style={{ width: 26, height: 26, fontSize: 11, borderRadius: 7 }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="rw-name">{p.name}</div>
                <div className={`rw-score ${p.trust_score >= 70 ? 'rw-s-hi' : p.trust_score >= 45 ? 'rw-s-mi' : 'rw-s-lo'}`}>
                  {p.trust_score}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
