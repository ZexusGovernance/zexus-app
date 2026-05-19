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
import PostCard from '@/components/feed/PostCard'
import PostDetailModal from '@/components/feed/PostDetailModal'

type Tab = 'overview' | 'timeline' | 'milestones' | 'votes' | 'holders' | 'posts' | 'settings'

interface SocialLinks {
  website_url:    string | null
  whitepaper_url: string | null
  github_url:     string | null
  twitter_url:    string | null
  discord_url:    string | null
  avatar_url:     string | null
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
            <div key={k} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
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
          <div key={i} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, paddingRight: 10 }}>{v.title}</div>
              <span className={`status-pill ${v.statusClass}`} style={{ flexShrink: 0 }}>{v.status}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                <span style={{ color: 'var(--green)' }}>Yes {v.yes}%</span>
                <span style={{ color: 'var(--red)' }}>No {v.no}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
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
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
              {h.letter}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{h.address}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{h.amount}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 500 }}>{h.pct}</div>
          </div>
        ))}
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
  const [editAvatarUrl,   setEditAvatarUrl]   = useState('')
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

  // Load live project settings + social links (public read)
  useEffect(() => {
    if (!slug) return
    supabase
      .from('projects')
      .select('id, show_holders, show_votes, has_token, website_url, whitepaper_url, github_url, twitter_url, discord_url, avatar_url')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProjectDbId(data.id)
          setShowHolders(data.show_holders ?? true)
          setShowVotes(data.show_votes ?? true)
          setHasToken(data.has_token ?? false)
          setSocialLinks({
            website_url:    data.website_url    ?? null,
            whitepaper_url: data.whitepaper_url ?? null,
            github_url:     data.github_url     ?? null,
            twitter_url:    data.twitter_url    ?? null,
            discord_url:    data.discord_url    ?? null,
            avatar_url:     data.avatar_url     ?? null,
          })
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
          whitepaper_url: string | null; github_url: string | null;
          twitter_url: string | null; discord_url: string | null;
          avatar_url: string | null;
          show_holders: boolean; show_votes: boolean; has_token: boolean;
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
        } else {
          setIsAdmin(false)
        }
      })
      .catch(() => setIsAdmin(false))
  }, [address, slug, project])

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
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }
      const { project: saved } = await res.json() as {
        project: {
          show_holders: boolean; show_votes: boolean; has_token: boolean;
          website_url: string | null; whitepaper_url: string | null;
          github_url: string | null; twitter_url: string | null;
          discord_url: string | null; avatar_url: string | null;
        }
      }
      setShowHolders(saved.show_holders)
      setShowVotes(saved.show_votes)
      setHasToken(saved.has_token)
      setEditShowHolders(saved.show_holders)
      setEditShowVotes(saved.show_votes)
      setEditHasToken(saved.has_token)
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
    ...(showVotes   ? [{ id: 'votes'    as Tab, label: 'Votes' }]    : []),
    ...(showHolders ? [{ id: 'holders'  as Tab, label: 'Holders' }]  : []),
    ...(isAdmin     ? [{ id: 'settings' as Tab, label: '⚙ Settings' }] : []),
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
      <Nav currentPage="projects" onNavigate={handleNavigate} onSearchOpen={() => {}} onCheckInOpen={() => {}} />

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
                alt={project.name}
                style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div className={`pdh-av ${project.av}`} style={{ width: 52, height: 52, fontSize: 20 }}>{project.letter}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pdh-name">{project.name}</div>
              <div className="pdh-sub">{project.cat} · {project.holders} holders</div>
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
                {project.tags.map((t, i) => (
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
          {/* Posts — feed card style */}
          {activeTab === 'posts' && (
            <div>
              {loadingPosts && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 12 }}>Loading posts…</div>
              )}
              {!loadingPosts && posts.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 13 }}>No posts yet</div>
              )}
              <div className="feed-posts-grid" style={{ gridTemplateColumns: '1fr' }}>
                {posts.map((post, i) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={i}
                    onClick={() => { setScrollToComments(false); setSelectedPost(post) }}
                    onCommentClick={() => { setScrollToComments(true); setSelectedPost(post) }}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'overview'   && <OverviewTab   project={project} />}
          {activeTab === 'timeline'   && <TimelineTab   project={project} />}
          {activeTab === 'milestones' && <MilestonesTab project={project} />}
          {activeTab === 'votes'      && <VotesTab      project={project} />}
          {activeTab === 'holders'    && <HoldersTab    project={project} />}

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
                      <label className="create-label">AVATAR URL</label>
                      <input className="create-input" value={editAvatarUrl} onChange={e => setEditAvatarUrl(e.target.value)} placeholder="https://…" />
                    </div>
                  </div>
                </div>
              </div>

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
          projectName={project.name}
          onPublish={post => { setPosts(prev => [post, ...prev]); setCreateOpen(false) }}
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
          <div className="s-row"><span className="s-k">Category</span><span className="s-v">{project.cat.split(' · ')[0]}</span></div>
        </div>
        <div className="panel">
          <div className="panel-title">Actions</div>
          <button className="action-btn"><i className="ph-bold ph-shield-check" /> Verify holding</button>
          <button
            className="action-btn"
            onClick={toggleWatchlist}
            disabled={watchlistLoading || !address}
            style={watchlisted ? { color: '#6f9be5', borderColor: 'rgba(111,155,229,0.4)' } : {}}
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
