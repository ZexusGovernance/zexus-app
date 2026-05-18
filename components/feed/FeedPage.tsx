'use client'

import { useState, useEffect } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import PostCard from './PostCard'
import PostDetailModal from './PostDetailModal'
import CreatePostModal from './CreatePostModal'
import FeedDashboard from './FeedDashboard'
import type { FeedPost, PostType } from '@/lib/feedData'
import type { DbPost } from '@/lib/supabase'
import { PROJECTS_FULL } from '@/lib/projects'

type FilterType = 'All' | 'Verdicts' | 'Updates' | 'Alerts'

const FILTER_TYPES: Record<FilterType, PostType[] | null> = {
  All:      null,
  Verdicts: ['verdict', 'voting'],
  Updates:  ['update'],
  Alerts:   ['alert'],
}

const AV_CLASSES = ['av-blue', 'av-teal', 'av-purple', 'av-red', 'av-gold']

function projectAv(name: string): string {
  const proj = PROJECTS_FULL.find(p => p.name === name)
  if (proj) return proj.av
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AV_CLASSES[hash % AV_CLASSES.length]
}

function dbToFeed(row: DbPost): FeedPost {
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
    ...(row.trust_score_change != null && row.trust_score_change !== 0
      ? { trustScoreChange: row.trust_score_change }
      : {}),
  }
}

interface FeedPageProps {
  onNavigate:     (page: string) => void
  initialPostId?: string | null
}

export default function FeedPage({ onNavigate: _onNavigate, initialPostId }: FeedPageProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('All')
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null)
  const [createOpen,   setCreateOpen]   = useState(false)
  const [dbPosts,      setDbPosts]      = useState<FeedPost[]>([])

  const { address } = useAppKitAccount()
  const [userRole,     setUserRole]     = useState<'user' | 'project'>('user')
  const [adminProject, setAdminProject] = useState<{ name: string } | null>(null)

  // Load posts from API
  useEffect(() => {
    fetch('/api/posts?limit=50')
      .then(r => r.json())
      .then(({ posts }: { posts: DbPost[] }) => {
        if (posts) setDbPosts(posts.map(dbToFeed))
      })
      .catch(console.error)
  }, [])

  // Open a specific post from a deep link (?post=ID)
  useEffect(() => {
    if (!initialPostId) return
    // Try to find it in already-loaded posts
    const found = dbPosts.find(p => p.id === initialPostId)
    if (found) { setSelectedPost(found); return }
    // Not in cache — fetch via API
    fetch(`/api/posts?id=${encodeURIComponent(initialPostId)}`)
      .then(r => r.json())
      .then(({ posts }: { posts: DbPost[] }) => {
        if (posts?.[0]) setSelectedPost(dbToFeed(posts[0]))
      })
      .catch(() => {})
  }, [initialPostId, dbPosts])

  // Role check on wallet change
  useEffect(() => {
    if (!address) {
      setUserRole('user')
      setAdminProject(null)
      return
    }
    fetch(`/api/check-role?wallet=${address}`)
      .then(r => r.json())
      .then((data: { role: 'user' | 'project'; project: { name: string } | null }) => {
        setUserRole(data.role)
        setAdminProject(data.project ?? null)
      })
      .catch(() => setUserRole('user'))
  }, [address])

  const filtered = dbPosts.filter(post => {
    const types = FILTER_TYPES[activeFilter]
    return types === null || types.includes(post.type)
  })

  return (
    <div className="page active" id="page-feed">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="page-title">Feed</div>
              <div className="page-sub">All platform events in real time</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingBottom: '16px' }}>
              {(['All', 'Verdicts', 'Updates', 'Alerts'] as FilterType[]).map(f => (
                <button
                  key={f}
                  className={`filter-btn${activeFilter === f ? ' active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </button>
              ))}
              {userRole === 'project' && (
                <button
                  className="create-post-btn"
                  onClick={() => setCreateOpen(true)}
                  title="Create post"
                  aria-label="Create post"
                >
                  <i className="ti ti-pencil-plus" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="scroll">
          <div className="feed-posts-grid">
            {filtered.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onClick={() => setSelectedPost(post)}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px 0', fontSize: '13px' }}>
              No posts for this filter
            </div>
          )}
        </div>
      </div>

      <div className="right">
        <FeedDashboard posts={dbPosts} />
      </div>

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
      {createOpen && address && adminProject && (
        <CreatePostModal
          onClose={() => setCreateOpen(false)}
          onPublish={post => setDbPosts(prev => [post, ...prev])}
          walletAddress={address}
          projectName={adminProject.name}
        />
      )}
    </div>
  )
}
