'use client'

import { useEffect, useRef, useState } from 'react'
import type { FeedPost } from '@/lib/feedData'
import { supabase } from '@/lib/supabase'
import { useAppKitAccount } from '@reown/appkit/react'

const TYPE_ICON: Record<string, string> = {
  alert: 'ti-alert-triangle', voting: 'ti-clock', verdict: 'ti-shield-check',
  update: 'ti-speakerphone', new: 'ti-sparkles', investment: 'ti-trending-up',
}
const TYPE_LABEL: Record<string, string> = {
  alert: 'Alert', voting: 'Voting', verdict: 'Verdict',
  update: 'Update', new: 'New', investment: 'Investment',
}
const TYPE_BADGE: Record<string, string> = {
  alert: 'tb-alert', voting: '', verdict: 'tb-verdict',
  update: 'tb-update', new: 'tb-new', investment: 'tb-invest',
}

const AV_CLASSES = ['av-blue', 'av-teal', 'av-purple', 'av-red', 'av-gold']
const URL_RE     = /https?:\/\/[^\s<>"')]+/g

function walletAv(wallet: string): string {
  const hash = wallet.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AV_CLASSES[hash % AV_CLASSES.length]
}

function isUUID(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}
function getDeviceId() {
  let id = localStorage.getItem('zx_device_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('zx_device_id', id) }
  return id
}
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
function exactTime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function LinkifiedLine({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const url = match[0]
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--gold)', textDecoration: 'none', wordBreak: 'break-all' }}
      >
        {url}
      </a>,
    )
    lastIndex = match.index + url.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

function TextWithLinks({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          <LinkifiedLine text={line || ' '} />
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  )
}

async function doShare(post: FeedPost, setCopied: (v: boolean) => void) {
  const url = `${window.location.origin}/post/${post.id}`
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `${post.project}: ${post.title || post.type}`,
        text:  post.text.slice(0, 120),
        url,
      })
      return
    } catch { /* cancelled */ }
  }
  await navigator.clipboard.writeText(url).catch(() => {})
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

interface Comment {
  id: string; author: string; letter: string; av: string; text: string; time: string
}

interface CommentLikeState {
  liked: boolean
  count: number
  loading: boolean
}

interface CommentRowProps {
  c: Comment
  idx: number
  isNew: boolean
  revealed: boolean
  isDbPost: boolean
  likeState: CommentLikeState
  onLike: () => void
}

function CommentRow({ c, idx, isNew, revealed, isDbPost, likeState, onLike }: CommentRowProps) {
  const shouldAnimate = isNew || revealed
  const animClass = isNew ? ' comment-new' : revealed ? ' comment-enter-anim' : ''
  return (
    <div
      className={`comment-item${animClass}`}
      style={shouldAnimate ? { animationDelay: `${idx * 60}ms` } : undefined}
    >
      <div className={`proj-av ${c.av}`} style={{ width: 28, height: 28, fontSize: 11, borderRadius: 8, flexShrink: 0 }}>
        {c.letter}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{c.author}</span>&nbsp;·&nbsp;{c.time}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, overflowWrap: 'break-word' }}>
          <TextWithLinks text={c.text} />
        </div>
      </div>
      {isDbPost && (
        <button
          onClick={onLike}
          title={likeState.liked ? 'Unlike' : 'Like'}
          style={{
            display: 'flex', alignItems: 'center', gap: 3, padding: '3px 6px',
            background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
            color: likeState.liked ? 'var(--red)' : 'var(--muted2)', fontSize: 11,
            transition: 'color 0.15s',
          }}
        >
          <i className={`${likeState.liked ? 'ph-fill' : 'ph-bold'} ph-heart`} style={{ fontSize: 12 }} />
          {likeState.count > 0 && <span>{likeState.count}</span>}
        </button>
      )}
    </div>
  )
}

interface PostDetailModalProps {
  post: FeedPost | null
  onClose: () => void
}

export default function PostDetailModal({ post, onClose }: PostDetailModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const isDbPost = !!post && isUUID(post.id)

  const { address } = useAppKitAccount()

  const [dbComments,      setDbComments]      = useState<Comment[]>([])
  const [commentText,     setCommentText]      = useState('')
  const [submitting,      setSubmitting]       = useState(false)
  const [liked,           setLiked]            = useState(false)
  const [likeCount,       setLikeCount]        = useState(0)
  const [copied,          setCopied]           = useState(false)
  const [showAllComments, setShowAllComments]  = useState(false)
  const [newCommentIds,   setNewCommentIds]    = useState<Set<string>>(new Set())
  const [revealedIds,     setRevealedIds]      = useState<Set<string>>(new Set())
  const [commentLikes,    setCommentLikes]     = useState<Record<string, CommentLikeState>>({})

  // Realtime like count + liked status sync
  useEffect(() => {
    if (!post || !isDbPost) return
    const channel = supabase
      .channel(`likes-${post.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'post_reactions',
        filter: `post_id=eq.${post.id}`,
      }, () => {
        const identifier = address ?? getDeviceId()
        fetch(`/api/posts/react?post_id=${post.id}&identifier=${encodeURIComponent(identifier)}`)
          .then(r => r.json())
          .then(({ liked: l, count }) => { setLiked(!!l); setLikeCount(count ?? 0) })
          .catch(() => {})
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [post?.id, isDbPost, address])

  useEffect(() => {
    if (!post) return
    panelRef.current?.scrollTo(0, 0)
    setCommentText('')
    setDbComments([])
    setShowAllComments(false)
    setNewCommentIds(new Set())
    setRevealedIds(new Set())
    setCommentLikes({})

    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)

    if (isDbPost) {
      const identifier = address ?? getDeviceId()

      fetch(`/api/comments?post_id=${post.id}`)
        .then(r => r.json())
        .then(({ comments }: { comments: { id: string; author_wallet: string; content: string; created_at: string }[] }) => {
          if (!comments) return
          const mapped = comments.map(c => ({
            id:     c.id,
            author: `${c.author_wallet.slice(0, 6)}...${c.author_wallet.slice(-4)}`,
            letter: c.author_wallet.slice(2, 3).toUpperCase(),
            av:     walletAv(c.author_wallet),
            text:   c.content,
            time:   relativeTime(c.created_at),
          }))
          setDbComments(mapped)
          mapped.forEach(c => {
            fetch(`/api/comments/react?comment_id=${c.id}&identifier=${encodeURIComponent(identifier)}`)
              .then(r => r.json())
              .then(({ liked: l, count }) => {
                setCommentLikes(prev => ({ ...prev, [c.id]: { liked: !!l, count: count ?? 0, loading: false } }))
              })
              .catch(() => {})
          })
        })
        .catch(console.error)

      fetch(`/api/posts/react?post_id=${post.id}&identifier=${encodeURIComponent(identifier)}`)
        .then(r => r.json())
        .then(({ liked: l, count }) => { setLiked(!!l); setLikeCount(count ?? 0) })
        .catch(() => {})
    }

    return () => document.removeEventListener('keydown', handler)
  }, [post, onClose, isDbPost, address])

  const submitComment = async () => {
    if (!commentText.trim() || !post || submitting) return
    setSubmitting(true)
    const identifier = address ?? getDeviceId()

    if (isDbPost) {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: identifier, post_id: post.id, content: commentText.trim() }),
      }).catch(() => null)

      if (res?.ok) {
        const { comment } = await res.json() as { comment: { id: string; author_wallet: string; content: string; created_at: string } }
        const newC = {
          id:     comment.id,
          author: `${comment.author_wallet.slice(0, 6)}...${comment.author_wallet.slice(-4)}`,
          letter: comment.author_wallet.slice(2, 3).toUpperCase(),
          av:     walletAv(comment.author_wallet),
          text:   comment.content,
          time:   'just now',
        }
        setDbComments(prev => [...prev, newC])
        setNewCommentIds(prev => new Set([...prev, newC.id]))
        setRevealedIds(prev => new Set([...prev, newC.id]))
        setCommentLikes(prev => ({ ...prev, [newC.id]: { liked: false, count: 0, loading: false } }))
        setShowAllComments(true)
      }
    }

    setCommentText('')
    setSubmitting(false)
  }

  const toggleLike = async () => {
    if (!post) return
    const identifier = address ?? getDeviceId()
    const wasLiked = liked
    const wasCount = likeCount
    setLiked(!wasLiked)
    setLikeCount(wasLiked ? Math.max(0, wasCount - 1) : wasCount + 1)
    if (!isDbPost) return
    const res = await fetch('/api/posts/react', {
      method: wasLiked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, identifier }),
    }).catch(() => null)
    if (!res?.ok) {
      setLiked(wasLiked)
      setLikeCount(wasCount)
    } else {
      const d = await res.json().catch(() => null)
      if (d?.count !== undefined) setLikeCount(d.count)
    }
  }

  const toggleCommentLike = async (commentId: string) => {
    const identifier = address ?? getDeviceId()
    const prev = commentLikes[commentId] ?? { liked: false, count: 0, loading: false }
    if (prev.loading) return
    const wasLiked = prev.liked
    const wasCount = prev.count
    setCommentLikes(s => ({ ...s, [commentId]: { liked: !wasLiked, count: wasLiked ? Math.max(0, wasCount - 1) : wasCount + 1, loading: true } }))
    const res = await fetch('/api/comments/react', {
      method: wasLiked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId, identifier }),
    }).catch(() => null)
    if (!res?.ok) {
      setCommentLikes(s => ({ ...s, [commentId]: { liked: wasLiked, count: wasCount, loading: false } }))
    } else {
      const d = await res.json().catch(() => null)
      setCommentLikes(s => ({ ...s, [commentId]: { liked: !wasLiked, count: d?.count ?? (wasLiked ? Math.max(0, wasCount - 1) : wasCount + 1), loading: false } }))
    }
  }

  if (!post) return null

  const votingBadge = post.type === 'voting'
    ? { background: 'rgba(201,165,90,0.1)', color: 'var(--gold)', border: '0.5px solid rgba(201,165,90,0.25)' } : {}
  const investBadge = post.type === 'investment'
    ? { background: 'rgba(138,111,201,0.12)', color: '#8a6fc9', border: '0.5px solid rgba(138,111,201,0.3)' } : {}

  const staticComments: Comment[] = post.comments.map((c, i) => ({
    id: String(i), author: c.author, letter: c.letter, av: c.av, text: c.text, time: c.time,
  }))
  const allComments = isDbPost ? dbComments : staticComments

  const myLetter = address ? address.slice(2, 3).toUpperCase() : 'U'
  const myAv     = address ? walletAv(address) : 'av-gold'

  const EMPTY_LIKE: CommentLikeState = { liked: false, count: 0, loading: false }

  const timeDisplay = post.createdAt ? exactTime(post.createdAt) : post.time

  return (
    <div className="post-modal-overlay" onClick={onClose}>
      <div className="post-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>

        {/* Header */}
        <div className="post-modal-head">
          <span style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: '0.5px' }}>Post</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isDbPost && (
              <button
                className="post-modal-close"
                onClick={() => doShare(post, setCopied)}
                title={copied ? 'Copied!' : 'Share post'}
                style={{ fontSize: 13, color: copied ? 'var(--green)' : undefined }}
              >
                <i className={`ph-bold ${copied ? 'ph-check' : 'ph-share-network'}`} />
              </button>
            )}
            <button className="post-modal-close" onClick={onClose}><i className="ph-bold ph-x" /></button>
          </div>
        </div>

        <div className="post-modal-scroll" ref={panelRef}>

          {/* Emergency banner */}
          {post.isEmergency && (
            <div style={{ margin: '-4px -4px 16px', padding: '10px 16px', borderRadius: 8,
              background: 'rgba(224,112,112,0.1)', border: '1px solid rgba(224,112,112,0.35)',
              display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ph-bold ph-warning-octagon" style={{ color: 'var(--red)', fontSize: 18 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>Emergency Call Active</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                  This alert has been escalated. Verified holders can trigger the Emergency protocol.
                </div>
              </div>
            </div>
          )}

          {/* Project row */}
          <div className="card-head" style={{ marginBottom: 16, padding: 0 }}>
            <div className={`proj-av ${post.av}`} style={{ width: 38, height: 38, fontSize: 15, borderRadius: 10 }}>
              {post.letter}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{post.project}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{post.sub}</div>
            </div>
            <span className={`type-badge ${TYPE_BADGE[post.type]}`} style={{ ...votingBadge, ...investBadge }}>
              <i className={`ti ${TYPE_ICON[post.type]}`} style={{ fontSize: 9 }} /> {TYPE_LABEL[post.type]}
            </span>
            <div className="card-time" title={post.time}>{timeDisplay}</div>
          </div>

          {/* Title */}
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14, lineHeight: 1.35 }}>
            {post.title}
          </h2>

          {/* Content with clickable links */}
          <div style={{
            fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 18,
            maxWidth: '62ch', overflowWrap: 'break-word', wordBreak: 'break-word',
          }}>
            <TextWithLinks text={post.detailText} />
          </div>

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {post.images.map((url, i) => (
                <img key={i} src={url} alt="" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10,
                  border: '0.5px solid var(--border2)', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => window.open(url, '_blank')} />
              ))}
            </div>
          )}

          {/* Investment details */}
          {post.investment && (
            <div style={{ marginBottom: 18, padding: '14px 16px', background: 'rgba(138,111,201,0.06)',
              border: '0.5px solid rgba(138,111,201,0.3)', borderRadius: 12 }}>
              <div style={{ fontSize: 10, color: '#8a6fc9', fontWeight: 700, letterSpacing: '1.5px', marginBottom: 10 }}>
                <i className="ph-bold ph-trend-up" style={{ marginRight: 5 }} />INVESTMENT ROUND
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[['Round', post.investment.round], ['Amount', post.investment.amount], ['Lead Investor', post.investment.lead || '—']].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vote bar */}
          {post.vote && (
            <div style={{ marginBottom: 18 }}>
              <div className="verdict-bar">
                <span className="vb-yes">{post.vote.yes}%</span>
                <div className="vb-track">
                  <div className="vb-fill-y" style={{ width: `${post.vote.yes}%` }} />
                  <div className="vb-fill-n" style={{ width: `${100 - post.vote.yes}%` }} />
                </div>
                <span className="vb-no">{100 - post.vote.yes}%</span>
                <span className="vb-count">{post.vote.count}</span>
              </div>
              {post.vote.open && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <button className="bet-btn bb-yes"><i className="ph-bold ph-thumbs-up" /> Confirm</button>
                  <button className="bet-btn bb-no"><i className="ph-bold ph-thumbs-down" /> Dispute</button>
                  {post.vote.timeLeft && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gold-dim)' }}>
                      <i className="ph-bold ph-clock" /> {post.vote.timeLeft} · +{post.vote.zxp} ZXP
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Trust Score Change */}
          {post.trustScoreChange !== undefined && post.trustScoreChange !== 0 && (
            <div style={{ marginBottom: 18 }}>
              <span className={`score-pill ${post.trustScoreChange > 0 ? 'sp-up' : 'sp-down'}`}>
                <i className={`ti ${post.trustScoreChange > 0 ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ fontSize: 11 }} />
                &nbsp;{post.trustScoreChange > 0 ? '+' : ''}{post.trustScoreChange} pts Trust Score
              </span>
            </div>
          )}

          {/* Legacy score pill */}
          {post.score && !post.trustScoreChange && (
            <div style={{ marginBottom: 18 }}>
              <span className={`score-pill ${post.score.dir === 'up' ? 'sp-up' : 'sp-down'}`}>
                <i className={`ti ${post.score.dir === 'up' ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ fontSize: 11 }} />
                &nbsp;{post.score.delta}&nbsp;·&nbsp;Trust Score: {post.score.value}
              </span>
            </div>
          )}

          {/* Legacy trust bar */}
          {post.trust && (
            <div className="trust-mini" style={{ marginBottom: 18 }}>
              <div>
                <div className="tm-num" style={{ color: post.trust.color }}>{post.trust.value}</div>
                <div className="tm-lbl">Trust Score</div>
              </div>
              <div className="tm-bar-wrap">
                <div className="tm-bar-fill" style={{ width: `${post.trust.value}%`, background: post.trust.color }} />
              </div>
            </div>
          )}

          {/* Alert actions */}
          {post.type === 'alert' && (
            <div style={{ marginBottom: 18, display: 'flex', gap: 8 }}>
              <div className="foot-btn danger" style={{ display: 'inline-flex' }}>
                <i className="ph-bold ph-warning-octagon" /> Emergency Call
              </div>
            </div>
          )}

          {/* Like row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button
              onClick={toggleLike}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                borderRadius: 8, border: `0.5px solid ${liked ? 'rgba(201,165,90,0.4)' : 'var(--border2)'}`,
                background: liked ? 'rgba(201,165,90,0.08)' : 'var(--surface2)', cursor: 'pointer',
                color: liked ? 'var(--gold)' : 'var(--muted)', fontSize: 12, transition: 'all 0.15s' }}>
              <i className={`${liked ? 'ph-fill' : 'ph-bold'} ph-heart`} />
              <span>{liked ? 'Liked' : 'Like'}</span>
              {likeCount > 0 && <span style={{ color: 'var(--muted2)' }}>· {likeCount}</span>}
            </button>
          </div>

          <div style={{ borderTop: '0.5px solid var(--border)', margin: '4px 0 18px' }} />

          {/* Comments */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 14 }}>
              Discussion · {allComments.length} {allComments.length === 1 ? 'comment' : 'comments'}
            </div>

            {allComments.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted2)', textAlign: 'center', padding: '8px 0 14px' }}>
                No comments yet. Be the first.
              </div>
            )}

            {allComments.slice(0, 3).map((c, idx) => (
              <CommentRow
                key={c.id}
                c={c}
                idx={idx}
                isNew={newCommentIds.has(c.id)}
                revealed={revealedIds.has(c.id)}
                isDbPost={isDbPost}
                likeState={commentLikes[c.id] ?? EMPTY_LIKE}
                onLike={() => toggleCommentLike(c.id)}
              />
            ))}

            {allComments.length > 3 && !showAllComments && (
              <button
                onClick={() => {
                  const toReveal = new Set(allComments.slice(3).map(c => c.id))
                  setRevealedIds(prev => new Set([...prev, ...toReveal]))
                  setShowAllComments(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 0',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)',
                  fontSize: 12, fontFamily: 'inherit', marginBottom: 8 }}
              >
                <i className="ph-bold ph-caret-down" style={{ fontSize: 13 }} />
                Show {allComments.length - 3} more {allComments.length - 3 === 1 ? 'comment' : 'comments'}
              </button>
            )}

            {showAllComments && allComments.slice(3).map((c, idx) => (
              <CommentRow
                key={c.id}
                c={c}
                idx={idx}
                isNew={newCommentIds.has(c.id)}
                revealed={revealedIds.has(c.id)}
                isDbPost={isDbPost}
                likeState={commentLikes[c.id] ?? EMPTY_LIKE}
                onLike={() => toggleCommentLike(c.id)}
              />
            ))}

            {showAllComments && allComments.length > 3 && (
              <button
                onClick={() => { setShowAllComments(false); setRevealedIds(new Set()) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted2)',
                  fontSize: 11, fontFamily: 'inherit', marginBottom: 8 }}
              >
                <i className="ph-bold ph-caret-up" style={{ fontSize: 12 }} />
                Collapse
              </button>
            )}

            {/* Add comment */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
              <div className={`proj-av ${myAv}`} style={{ width: 28, height: 28, fontSize: 11, borderRadius: 8, flexShrink: 0 }}>
                {myLetter}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  className="comment-input"
                  placeholder={address ? 'Add a comment…' : 'Connect wallet to comment'}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
                  disabled={!address}
                  style={{ flex: 1 }}
                />
              </div>
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submitting || !address}
                style={{ width: 34, height: 34, borderRadius: 9, border: 'none',
                  background: commentText.trim() && address ? 'var(--gold)' : 'var(--border2)',
                  color: commentText.trim() && address ? '#0b0a09' : 'var(--muted)',
                  cursor: commentText.trim() && address ? 'pointer' : 'not-allowed', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                <i className="ph-bold ph-paper-plane-tilt" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
