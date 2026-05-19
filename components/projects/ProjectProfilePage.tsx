'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppKitAccount } from '@reown/appkit/react'
import Nav from '@/components/nav/Nav'
import { PROJECTS_FULL } from '@/lib/projects'
import type { ProjectFull, TimelineEvent } from '@/lib/projects'
import type { FeedPost, PostType } from '@/lib/feedData'
import type { DbPost } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import CreatePostModal from '@/components/feed/CreatePostModal'
import PostDetailModal from '@/components/feed/PostDetailModal'

type Tab = 'overview' | 'timeline' | 'milestones' | 'votes' | 'holders' | 'posts'

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
    sub:         row.project_category ?? 'Protocol',
    title:       row.title ?? '',
    text:        row.content,
    detailText:  row.content,
    time:        new Date(row.created_at).toLocaleString('en-US', {
      hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric',
    }),
    comments:  [],
    images:    row.image_url ? [row.image_url] : undefined,
    likeCount: row.likes_count,
    ...(row.trust_score_change != null && row.trust_score_change !== 0
      ? { trustScoreChange: row.trust_score_change } : {}),
  }
}

function TrustScore({ score, label, trend, trendClass }: { score: number | null; label: string; trend: string; trendClass: string }) {
  const pct = score ?? 0
  return (
    <div className="panel">
      <div className="panel-title">Trust Score</div>
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

function OverviewTab({ project }: { project: ProjectFull }) {
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
            { k: 'Holders', v: project.holders },
            { k: 'Community verdicts', v: String(project.verdicts) },
            { k: 'Category', v: project.cat.split(' · ')[0] },
            { k: 'Trust Score', v: project.score !== null ? String(project.score) : 'Unscored' },
          ].map(({ k, v }) => (
            <div key={k} style={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineTab({ project }: { project: ProjectFull }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(
    () => {
      const days = Object.keys(project.timelineEvents).map(Number)
      return days.length > 0 ? Math.max(...days) : null
    },
  )

  const selectedEvent: TimelineEvent | null = selectedDay !== null
    ? project.timelineEvents[selectedDay] ?? {
        date: `May ${String(selectedDay).padStart(2, '0')}`,
        title: 'No activity',
        status: 'Status: No activity',
        votes: 'Votes: —',
        impact: 'Trust Score impact: 0',
        type: 'none',
      }
    : null

  return (
    <div className="trust-timeline-card" id="trust-timeline">
      <div className="concept-head">
        <div>
          <div className="concept-title">Trust Timeline</div>
          <div className="concept-sub">Every promise, missed deadline, update, and community verdict becomes visible over time.</div>
        </div>
        <div className="timeline-legend">
          <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(83,201,146,0.62)' }} />Verified</span>
          <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(225,184,94,0.68)' }} />Voting</span>
          <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(238,121,121,0.62)' }} />Risk</span>
          <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(111,155,229,0.68)' }} />Important</span>
        </div>
      </div>
      <div className="timeline-grid">
        {Array.from({ length: 30 }, (_, i) => {
          const day = i + 1
          const event = project.timelineEvents[day]
          const type = event ? event.type : 'none'
          return (
            <button
              key={day}
              className={`timeline-day tl-${type}${selectedDay === day ? ' active' : ''}`}
              type="button"
              aria-label={`May ${String(day).padStart(2, '0')}`}
              onClick={() => setSelectedDay(day)}
            />
          )
        })}
      </div>
      {selectedEvent && (
        <div className="timeline-detail">
          <div>
            <div className="timeline-date">{selectedEvent.date}</div>
            <div className="timeline-event-title">{selectedEvent.title}</div>
            <div className="timeline-meta">
              {selectedEvent.status}<br />
              {selectedEvent.votes}<br />
              {selectedEvent.impact}
            </div>
          </div>
          <div />
        </div>
      )}
    </div>
  )
}

function MilestonesTab({ project }: { project: ProjectFull }) {
  return (
    <div className="roadmap-promises">
      <div className="concept-head">
        <div>
          <div className="concept-title">Roadmap Promises</div>
          <div className="concept-sub">Every milestone is a public commitment tracked on-chain.</div>
        </div>
      </div>
      <div className="milestone-list">
        {project.milestones.map((m, i) => (
          <div key={i} className="milestone-card">
            <div>
              <div className="milestone-name">{m.name}</div>
              <div className="milestone-meta">{m.date} · Impact: {m.impact}</div>
            </div>
            <span className={`status-pill ${m.statusClass}`}>{m.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VotesTab({ project }: { project: ProjectFull }) {
  return (
    <div className="roadmap-promises">
      <div className="concept-head">
        <div>
          <div className="concept-title">Active Proposals</div>
          <div className="concept-sub">Community votes shaping the protocol's future.</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {project.votes.map((v, i) => (
          <div key={i} style={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, paddingRight: 10 }}>{v.title}</div>
              <span className={`status-pill ${v.statusClass}`} style={{ flexShrink: 0 }}>{v.status}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                <span style={{ color: 'var(--green)' }}>Yes {v.yes}%</span>
                <span style={{ color: 'var(--red)' }}>No {v.no}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${v.yes}%`, background: 'var(--green)', borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Ends: {v.ends}</div>
          </div>
        ))}
        {project.votes.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No active proposals</div>
        )}
      </div>
    </div>
  )
}

function HoldersTab({ project }: { project: ProjectFull }) {
  return (
    <div className="roadmap-promises">
      <div className="concept-head">
        <div>
          <div className="concept-title">Top Holders</div>
          <div className="concept-sub">Largest verified token holders in the ecosystem.</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {project.topHolders.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface2)', border: '0.5px solid var(--border2)', borderRadius: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--gold)', flexShrink: 0 }}>
              {h.letter}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{h.address}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{h.amount}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 500 }}>{h.pct}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProjectProfilePage() {
  const params  = useParams()
  const router  = useRouter()
  const { address } = useAppKitAccount()

  const [activeTab,       setActiveTab]       = useState<Tab>('posts')
  const [watchlisted,     setWatchlisted]     = useState(false)
  const [projectDbId,     setProjectDbId]     = useState<string | null>(null)
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [posts,           setPosts]           = useState<FeedPost[]>([])
  const [loadingPosts,    setLoadingPosts]    = useState(false)
  const [selectedPost,    setSelectedPost]    = useState<FeedPost | null>(null)
  const [isAdmin,         setIsAdmin]         = useState(false)
  const [createOpen,      setCreateOpen]      = useState(false)

  // Live project settings from DB
  const [showHolders, setShowHolders] = useState(true)
  const [showVotes,   setShowVotes]   = useState(true)
  const [hasToken,    setHasToken]    = useState(false)

  // Edit state
  const [editMode,        setEditMode]        = useState(false)
  const [editName,        setEditName]        = useState('')
  const [editDesc,        setEditDesc]        = useState('')
  const [editCategory,    setEditCategory]    = useState('')
  const [editWebsite,     setEditWebsite]     = useState('')
  const [editShowHolders, setEditShowHolders] = useState(true)
  const [editShowVotes,   setEditShowVotes]   = useState(true)
  const [editHasToken,    setEditHasToken]    = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [saveMsg,         setSaveMsg]         = useState<string | null>(null)

  const slug    = Array.isArray(params.slug) ? params.slug[0] : params.slug
  const project = PROJECTS_FULL.find(p => p.id === slug)

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

  // Load live project visibility settings (public read via anon key)
  useEffect(() => {
    if (!slug) return
    supabase
      .from('projects')
      .select('id, show_holders, show_votes, has_token')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProjectDbId(data.id)
          setShowHolders(data.show_holders ?? true)
          setShowVotes(data.show_votes ?? true)
          setHasToken(data.has_token ?? false)
        }
      })
  }, [slug])

  // Admin check
  useEffect(() => {
    if (!address || !project) { setIsAdmin(false); return }
    fetch(`/api/check-role?wallet=${address}`)
      .then(r => r.json())
      .then((data: {
        role: string;
        project: {
          slug: string; name: string; description: string | null;
          category: string | null; website_url: string | null;
          show_holders: boolean; show_votes: boolean; has_token: boolean;
        } | null
      }) => {
        if (data.role === 'project' && data.project && data.project.slug === slug) {
          setIsAdmin(true)
          setEditName(data.project.name)
          setEditDesc(data.project.description ?? '')
          setEditCategory(data.project.category ?? '')
          setEditWebsite(data.project.website_url ?? '')
          setEditShowHolders(data.project.show_holders ?? true)
          setEditShowVotes(data.project.show_votes ?? true)
          setEditHasToken(data.project.has_token ?? false)
        } else {
          setIsAdmin(false)
        }
      })
      .catch(() => setIsAdmin(false))
  }, [address, slug, project])

  // Load watchlist status for current project
  useEffect(() => {
    if (!address || !projectDbId) return
    fetch(`/api/watchlist?wallet=${address}`)
      .then(r => r.json())
      .then(({ items }: { items: { project_id: string }[] }) => {
        setWatchlisted(items.some(i => i.project_id === projectDbId))
      })
      .catch(() => {})
  }, [address, projectDbId])

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

  async function saveProject() {
    if (!address) return
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet:        address,
          name:          editName,
          description:   editDesc,
          category:      editCategory,
          website_url:   editWebsite,
          show_holders:  editShowHolders,
          show_votes:    editShowVotes,
          has_token:     editHasToken,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }
      const { project: saved } = await res.json() as {
        project: { show_holders: boolean; show_votes: boolean; has_token: boolean }
      }
      // Apply saved values (API enforces has_token → show_holders = true)
      setShowHolders(saved.show_holders)
      setShowVotes(saved.show_votes)
      setHasToken(saved.has_token)
      setEditShowHolders(saved.show_holders)
      setEditShowVotes(saved.show_votes)
      setEditHasToken(saved.has_token)
      setSaveMsg('Saved!')
      setEditMode(false)
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!project) {
    return (
      <div className="shell">
        <Nav currentPage="projects" onNavigate={(p) => router.push(p === 'projects' ? '/projects' : `/?page=${p}`)} onSearchOpen={() => {}} onCheckInOpen={() => {}} />
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

  const handleNavigate = (page: string) => {
    if (page === 'projects') {
      router.push('/?page=projects')
    } else {
      router.push(`/?page=${page}`)
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'posts',      label: 'Posts' },
    { id: 'overview',   label: 'Overview' },
    { id: 'timeline',   label: 'Trust Timeline' },
    { id: 'milestones', label: 'Milestones' },
    ...(showVotes    ? [{ id: 'votes'   as Tab, label: 'Votes' }]   : []),
    ...(showHolders  ? [{ id: 'holders' as Tab, label: 'Holders' }] : []),
  ]

  return (
    <div className="shell">
      <Nav currentPage="projects" onNavigate={handleNavigate} onSearchOpen={() => {}} onCheckInOpen={() => {}} />

      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="proj-detail-header">
          <div className="back-btn" onClick={() => router.back()}>
            <i className="ph-bold ph-arrow-left" /> Back to projects
          </div>
          <div className="pdh-top">
            <div className={`pdh-av ${project.av}`} style={{ width: 52, height: 52, fontSize: 20 }}>{project.letter}</div>
            <div style={{ flex: 1 }}>
              <div className="pdh-name">{project.name}</div>
              <div className="pdh-sub">{project.cat} · {project.holders} holders</div>
              <div className="plc-tags">
                {project.tags.map((t, i) => (
                  <span key={i} className={`plc-tag${t.variant === 'verified' ? ' verified' : ''}`}>
                    {t.variant === 'verified' && <i className="ph-bold ph-check" style={{ fontSize: '9px' }} />}
                    {t.variant === 'verified' ? ' ' : ''}{t.label}
                  </span>
                ))}
                {isAdmin && (
                  <span className="plc-tag" style={{ background: 'rgba(201,165,90,0.12)', color: 'var(--gold)', border: '0.5px solid rgba(201,165,90,0.35)', cursor: 'pointer' }}
                    onClick={() => setEditMode(v => !v)}>
                    <i className="ph-bold ph-pencil" style={{ fontSize: '9px' }} /> Admin · Edit
                  </span>
                )}
              </div>
            </div>
            {isAdmin && (
              <button
                className="create-post-btn"
                onClick={() => setCreateOpen(true)}
                title="Write post"
                style={{ marginLeft: 8 }}
              >
                <i className="ph-bold ph-pencil-plus" />
              </button>
            )}
          </div>

          {/* Admin edit form */}
          {isAdmin && editMode && (
            <div style={{ padding: '14px 20px', background: 'rgba(201,165,90,0.05)', border: '0.5px solid rgba(201,165,90,0.2)', borderRadius: 12, margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, letterSpacing: '1px' }}>
                <i className="ph-bold ph-building" style={{ marginRight: 6 }} />EDIT PROJECT PROFILE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="create-field" style={{ marginBottom: 0 }}>
                  <label className="create-label">NAME</label>
                  <input className="create-input" value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="create-field" style={{ marginBottom: 0 }}>
                  <label className="create-label">CATEGORY</label>
                  <input className="create-input" value={editCategory} onChange={e => setEditCategory(e.target.value)} />
                </div>
              </div>
              <div className="create-field" style={{ marginBottom: 0 }}>
                <label className="create-label">DESCRIPTION</label>
                <textarea className="create-textarea" rows={2} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
              </div>
              <div className="create-field" style={{ marginBottom: 0 }}>
                <label className="create-label">WEBSITE</label>
                <input className="create-input" value={editWebsite} onChange={e => setEditWebsite(e.target.value)} placeholder="https://…" />
              </div>

              {/* Visibility toggles */}
              <div style={{ borderTop: '0.5px solid var(--border2)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>Tab Visibility</div>

                {/* Has token toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 500 }}>Project has a token</div>
                    <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 1 }}>Enabling forces Holders tab to always be visible</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !editHasToken
                      setEditHasToken(next)
                      if (next) setEditShowHolders(true)
                    }}
                    style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: editHasToken ? 'var(--gold)' : 'var(--border2)', position: 'relative', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      top: 3, left: editHasToken ? 19 : 3, transition: 'left 0.2s' }} />
                  </button>
                </div>

                {/* Show Holders */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, opacity: editHasToken ? 0.5 : 1 }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 500 }}>Show Holders tab</div>
                    {editHasToken && <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 1 }}>Locked — project has a token</div>}
                  </div>
                  <button
                    disabled={editHasToken}
                    onClick={() => setEditShowHolders(v => !v)}
                    style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: editHasToken ? 'not-allowed' : 'pointer',
                      background: editShowHolders ? 'var(--gold)' : 'var(--border2)', position: 'relative', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      top: 3, left: editShowHolders ? 19 : 3, transition: 'left 0.2s' }} />
                  </button>
                </div>

                {/* Show Votes */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 500 }}>Show Votes tab</div>
                    <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 1 }}>Community proposals & voting</div>
                  </div>
                  <button
                    onClick={() => setEditShowVotes(v => !v)}
                    style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: editShowVotes ? 'var(--gold)' : 'var(--border2)', position: 'relative', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      top: 3, left: editShowVotes ? 19 : 3, transition: 'left 0.2s' }} />
                  </button>
                </div>
              </div>

              {saveMsg && (
                <div style={{ fontSize: 12, color: saveMsg === 'Saved!' ? 'var(--green)' : 'var(--red)' }}>{saveMsg}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="publish-btn" style={{ flex: 1, opacity: saving ? 0.6 : 1 }} onClick={saveProject} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button className="filter-btn" onClick={() => setEditMode(false)}>Cancel</button>
              </div>
            </div>
          )}
          <div className="tabs trust-tabs">
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
        </div>

        <div className="scroll" style={{ padding: '16px 20px', flex: 1, overflow: 'auto' }}>
          {activeTab === 'posts' && (
            <div>
              {loadingPosts && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 12 }}>Loading posts…</div>
              )}
              {!loadingPosts && posts.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 13 }}>
                  No posts yet
                </div>
              )}
              {posts.map(post => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  style={{ cursor: 'pointer', background: 'var(--surface)', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                      background: post.type === 'alert' ? 'rgba(224,112,112,0.12)' : post.type === 'verdict' ? 'rgba(76,175,125,0.12)' : 'rgba(90,130,201,0.12)',
                      color: post.type === 'alert' ? 'var(--red)' : post.type === 'verdict' ? 'var(--green)' : '#5a82c9',
                    }}>
                      {post.type.charAt(0).toUpperCase() + post.type.slice(1)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{post.time}</span>
                  </div>
                  {post.title && (
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8, lineHeight: 1.35 }}>
                      {post.title}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {post.text}
                  </div>
                  {post.trustScoreChange != null && post.trustScoreChange !== 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 5,
                      background: post.trustScoreChange > 0 ? 'rgba(76,175,125,0.12)' : 'rgba(224,112,112,0.12)',
                      color: post.trustScoreChange > 0 ? 'var(--green)' : 'var(--red)',
                    }}>
                      {post.trustScoreChange > 0 ? '↑' : '↓'} {post.trustScoreChange > 0 ? '+' : ''}{post.trustScoreChange} pts
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'var(--muted2)' }}>
                    <span><i className="ph-bold ph-heart" style={{ marginRight: 3 }} />{post.likeCount ?? 0}</span>
                    <span><i className="ph-bold ph-chat" style={{ marginRight: 3 }} />{post.comments.length}</span>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted2)', fontSize: 11, padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}
                      onClick={e => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`).catch(() => {})
                      }}
                    >
                      <i className="ph-bold ph-share-network" /> Share
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'overview' && <OverviewTab project={project} />}
          {activeTab === 'timeline' && <TimelineTab project={project} />}
          {activeTab === 'milestones' && <MilestonesTab project={project} />}
          {activeTab === 'votes' && <VotesTab project={project} />}
          {activeTab === 'holders' && <HoldersTab project={project} />}
        </div>
      </div>

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
      {createOpen && address && isAdmin && (
        <CreatePostModal
          onClose={() => setCreateOpen(false)}
          walletAddress={address}
          projectName={project.name}
          onPublish={post => setPosts(prev => [post, ...prev])}
        />
      )}

      <div className="right" id="project-detail-right">
        <TrustScore
          score={project.score}
          label={project.trustLabel}
          trend={project.trend}
          trendClass={project.trendClass}
        />
        <div className="panel">
          <div className="panel-title">Stats</div>
          <div className="s-row"><span className="s-k">Holders</span><span className="s-v green">{project.holders}</span></div>
          <div className="s-row"><span className="s-k">Verdicts</span><span className="s-v">{project.verdicts}</span></div>
          <div className="s-row"><span className="s-k">Active since</span><span className="s-v">{project.activeSince}</span></div>
          <div className="s-row"><span className="s-k">Category</span><span className="s-v gold">{project.cat.split(' · ')[0]}</span></div>
        </div>
        <div className="panel">
          <div className="panel-title">Actions</div>
          <button className="action-btn primary"><i className="ph-bold ph-shield-check" /> Verify holding</button>
          <button
            className="action-btn"
            onClick={toggleWatchlist}
            disabled={watchlistLoading || !address}
            style={watchlisted ? { color: 'var(--gold)', borderColor: 'var(--gold)' } : {}}
          >
            <i className={`${watchlisted ? 'ph-fill' : 'ph-bold'} ph-bookmark-simple`} />
            {watchlistLoading ? ' …' : watchlisted ? ' Watchlisted' : ' Add to watchlist'}
          </button>
          <button className="emergency-btn"><i className="ph-bold ph-warning" /> Emergency Call</button>
        </div>
        <div className="panel">
          <div className="panel-title">Top verifiers</div>
          {project.verifiers.map((v, i) => (
            <div key={i} className="tv-row">
              <div className="tv-av">{v.letter}</div>
              <div className="tv-name">{v.address}</div>
              <div className="tv-pts">{v.pts}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
