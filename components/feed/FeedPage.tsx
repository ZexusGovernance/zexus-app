'use client'

import { useState, useEffect } from 'react'
import PostCard from './PostCard'
import PostDetailModal from './PostDetailModal'
import CreatePostModal from './CreatePostModal'
import FeedDashboard from './FeedDashboard'
import type { FeedPost, PostType } from '@/lib/feedData'
import type { DbPost } from '@/lib/supabase'
import { PROJECTS_FULL } from '@/lib/projects'

type FilterType = 'All' | 'Verdicts' | 'Updates' | 'Alerts'

function PostCardSkeleton() {
  return (
    <div className="card feed-card skeleton-card">
      <div className="skel-head">
        <div className="skel skel-av" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="skel" style={{ width: '55%', height: 11 }} />
          <div className="skel" style={{ width: '35%', height: 9 }} />
        </div>
        <div className="skel" style={{ width: 52, height: 18, borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
        <div className="skel" style={{ width: '70%', height: 13 }} />
        <div className="skel" style={{ width: '100%', height: 11 }} />
        <div className="skel" style={{ width: '88%', height: 11 }} />
        <div className="skel" style={{ width: '60%', height: 11 }} />
      </div>
      <div className="skel-footer">
        <div className="skel" style={{ width: 70, height: 26, borderRadius: 6 }} />
        <div className="skel" style={{ width: 44, height: 26, borderRadius: 6 }} />
        <div className="skel" style={{ width: 32, height: 26, borderRadius: 6 }} />
      </div>
    </div>
  )
}

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
  onNavigate:      (page: string) => void
  initialPostId?:  string | null
  // Compose modal — controlled from Shell
  composeOpen?:    boolean
  onComposeOpen?:  () => void
  onComposeClose?: () => void
  isProjectAdmin?: boolean
  adminProject?:   { name: string } | null
  walletAddress?:  string
}

export default function FeedPage({
  onNavigate: _onNavigate,
  initialPostId,
  composeOpen = false,
  onComposeOpen,
  onComposeClose,
  isProjectAdmin = false,
  adminProject,
  walletAddress,
}: FeedPageProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('All')
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null)
  const [dbPosts,      setDbPosts]      = useState<FeedPost[]>([])
  const [loading,      setLoading]      = useState(true)

  // Load posts from API
  useEffect(() => {
    fetch('/api/posts?limit=50')
      .then(r => r.json())
      .then(({ posts }: { posts: DbPost[] }) => {
        if (posts) setDbPosts(posts.map(dbToFeed))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Open a specific post from a deep link (?post=ID)
  useEffect(() => {
    if (!initialPostId) return
    const found = dbPosts.find(p => p.id === initialPostId)
    if (found) { setSelectedPost(found); return }
    fetch(`/api/posts?id=${encodeURIComponent(initialPostId)}`)
      .then(r => r.json())
      .then(({ posts }: { posts: DbPost[] }) => {
        if (posts?.[0]) setSelectedPost(dbToFeed(posts[0]))
      })
      .catch(() => {})
  }, [initialPostId, dbPosts])

  const filtered = dbPosts.filter(post => {
    const types = FILTER_TYPES[activeFilter]
    return types === null || types.includes(post.type)
  })

  return (
    <div className="page active" id="page-feed">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="page-header">
          <div className="feed-header-row">
            <div className="feed-title-wrapper">
              <div className="page-title">Feed</div>
              <div className="page-sub feed-page-sub">All platform events in real time</div>
            </div>
            <div className="feed-header-actions">
              {(['All', 'Verdicts', 'Updates', 'Alerts'] as FilterType[]).map(f => (
                <button
                  key={f}
                  className={`filter-btn${activeFilter === f ? ' active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </button>
              ))}
              {isProjectAdmin && (
                <button
                  className="create-post-btn create-post-btn-desktop"
                  onClick={() => onComposeOpen?.()}
                  aria-label="Create post"
                >
                  <i className="ti ti-pencil-plus" /> Post
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="scroll">
          <div className="feed-posts-grid">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <PostCardSkeleton key={i} />)
              : filtered.map((post, i) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onClick={() => setSelectedPost(post)}
                    index={i}
                  />
                ))
            }
          </div>
          {!loading && filtered.length === 0 && (
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
      {composeOpen && walletAddress && adminProject && (
        <CreatePostModal
          onClose={() => onComposeClose?.()}
          onPublish={post => { setDbPosts(prev => [post, ...prev]); onComposeClose?.() }}
          walletAddress={walletAddress}
          projectName={adminProject.name}
        />
      )}
    </div>
  )
}
