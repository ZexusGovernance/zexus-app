'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface DbProject {
  id:          string
  name:        string
  slug:        string
  category:    string | null
  description: string | null
  trust_score: number
  is_verified: boolean
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

export default function ProjectsPage() {
  const router = useRouter()
  const [projects,   setProjects]   = useState<DbProject[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('All')

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((d: { projects?: DbProject[] }) => {
        if (d.projects) setProjects(d.projects)
      })
      .finally(() => setLoading(false))
  }, [])

  const categories = ['All', ...Array.from(new Set(projects.map(p => p.category ?? 'Other').filter(Boolean)))]

  const visible = filter === 'All'
    ? projects
    : projects.filter(p => (p.category ?? 'Other') === filter)

  const verified  = projects.filter(p => p.is_verified).length
  const avgScore  = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.trust_score, 0) / projects.length)
    : 0
  const topThree  = [...projects].sort((a, b) => b.trust_score - a.trust_score).slice(0, 3)

  return (
    <div className="page active" id="page-projects">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <div className="page-title">Projects</div>
              <div className="page-sub">Verified projects on Base Mainnet</div>
            </div>
            <div className="filter-row" style={{ marginBottom: 0 }}>
              {categories.map(c => (
                <button
                  key={c}
                  className={`filter-btn${filter === c ? ' active' : ''}`}
                  onClick={() => setFilter(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="scroll" id="projects-list">
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              Loading…
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              No projects yet
            </div>
          )}

          {visible.map(p => {
            const sc    = scoreClass(p.trust_score)
            const avCol = avatarColor(p.slug)
            const letter = p.name.charAt(0).toUpperCase()

            return (
              <div
                key={p.id}
                className="proj-list-card"
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(`/projects/${p.slug}`)}
              >
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt={p.name}
                    style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div className={`proj-av ${avCol}`} style={{ width: 44, height: 44, fontSize: 18, borderRadius: 10 }}>
                    {letter}
                  </div>
                )}

                <div className="plc-info">
                  <div className="plc-name">{p.name}</div>
                  <div className="plc-sub">
                    {[p.category, 'Base Mainnet'].filter(Boolean).join(' · ')}
                  </div>
                  <div className="plc-tags">
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
          })}
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
