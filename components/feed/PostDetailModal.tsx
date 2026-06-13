'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { FeedPost } from '@/lib/feedData'
import { supabase } from '@/lib/supabase'
import { isEmergencyVerdict, verdictVoteLabel } from '@/lib/emergency-labels'
import Avatar from 'boring-avatars'

const AVATAR_COLORS = ['#0a0a0f', '#3b82f6', '#a855f7', '#22d3ee', '#65bf7f']
import { useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'

const TYPE_ICON: Record<string, string> = {
  alert: 'ph-bold ph-warning', voting: 'ph-bold ph-clock', verdict: 'ph-bold ph-shield-check',
  update: 'ph-bold ph-megaphone', new: 'ph-bold ph-sparkle', investment: 'ph-bold ph-trend-up',
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
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

function CommentAvatar({ wallet, letter, av, size = 28, avatarUrl }: { wallet: string; letter: string; av: string; size?: number; avatarUrl?: string | null }) {
  if (wallet) {
    return (
      <div style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="" style={{ width: size, height: size, objectFit: 'cover' }} />
          // Seed is lowercased so it matches the wallet's profile avatar exactly
          : <Avatar size={size} name={wallet.toLowerCase()} variant="marble" colors={AVATAR_COLORS} square />}
      </div>
    )
  }
  return (
    <div className={`proj-av ${av}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.4), borderRadius: 8, flexShrink: 0 }}>
      {letter}
    </div>
  )
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
  const url = `${window.location.origin}/post/${post.shortId ?? post.id}`
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
  id: string; author: string; letter: string; av: string; text: string; time: string; wallet: string
  parentId: string | null; avatarUrl: string | null; edited?: boolean
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
  onReply?: () => void
  isReply?: boolean
  mine?: boolean
  editing?: boolean
  editValue?: string
  onEdit?: () => void
  onDelete?: () => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onEditChange?: (v: string) => void
}

function CommentRow({ c, idx, isNew, revealed, isDbPost, likeState, onLike, onReply, isReply, mine, editing, editValue, onEdit, onDelete, onSaveEdit, onCancelEdit, onEditChange }: CommentRowProps) {
  const shouldAnimate = isNew || revealed
  const animClass = isNew ? ' comment-new' : revealed ? ' comment-enter-anim' : ''
  const isDeleted = c.text === '[deleted]'
  const iconBtn = {
    display: 'inline-flex', alignItems: 'center', padding: 0,
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--muted2)', fontSize: 13, transition: 'color 0.15s',
  } as const
  return (
    <div
      className={`comment-item${animClass}`}
      style={shouldAnimate ? { animationDelay: `${idx * 60}ms` } : undefined}
    >
      {c.wallet ? (
        <Link href={`/u/${c.wallet}`} title="View profile" style={{ display: 'flex', flexShrink: 0, textDecoration: 'none' }}>
          <CommentAvatar wallet={c.wallet} letter={c.letter} av={c.av} size={isReply ? 24 : 28} avatarUrl={c.avatarUrl} />
        </Link>
      ) : (
        <CommentAvatar wallet={c.wallet} letter={c.letter} av={c.av} size={isReply ? 24 : 28} avatarUrl={c.avatarUrl} />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
          {c.wallet ? (
            <Link href={`/u/${c.wallet}`} style={{ color: 'var(--text)', fontWeight: 500, textDecoration: 'none' }}>
              {c.author}
            </Link>
          ) : (
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{c.author}</span>
          )}
          &nbsp;·&nbsp;{c.time}
          {c.edited && !isDeleted && <span style={{ color: 'var(--muted2)' }}>&nbsp;·&nbsp;edited</span>}
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              value={editValue ?? ''}
              onChange={e => onEditChange?.(e.target.value)}
              rows={2}
              maxLength={500}
              className="create-textarea"
              style={{ fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onSaveEdit} style={{ ...iconBtn, color: 'var(--green)', fontSize: 12, fontWeight: 600 }}>Save</button>
              <button onClick={onCancelEdit} style={{ ...iconBtn, fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: isDeleted ? 'var(--muted2)' : 'var(--text)', lineHeight: 1.55, overflowWrap: 'break-word', fontStyle: isDeleted ? 'italic' : 'normal' }}>
            {isDeleted ? 'comment deleted' : <TextWithLinks text={c.text} />}
          </div>
        )}
        {isDbPost && !editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: -3, marginLeft: -12 }}>
            <button
              onClick={onLike}
              title={likeState.liked ? 'Unlike' : 'Like'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0,
                background: 'none', border: 'none', cursor: 'pointer',
                color: likeState.liked ? 'var(--red)' : 'var(--muted2)', fontSize: 11,
                fontFamily: 'inherit', transition: 'color 0.15s',
              }}
            >
              <i className={`${likeState.liked ? 'ph-fill' : 'ph-bold'} ph-heart`} style={{ fontSize: 13 }} />
              {likeState.count > 0 && <span>{likeState.count}</span>}
            </button>
            {onReply && (
              <button onClick={onReply} title="Reply" style={iconBtn}>
                <i className="ph-bold ph-arrow-bend-up-left" />
              </button>
            )}
            {mine && !isDeleted && (
              <>
                <button onClick={onEdit} title="Edit" style={iconBtn}>
                  <i className="ph-bold ph-pencil-simple" />
                </button>
                <button onClick={onDelete} title="Delete" style={iconBtn}>
                  <i className="ph-bold ph-trash" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface PostDetailModalProps {
  post:              FeedPost | null
  onClose:           () => void
  scrollToComments?: boolean
}

export default function PostDetailModal({ post, onClose, scrollToComments }: PostDetailModalProps) {
  const panelRef    = useRef<HTMLDivElement>(null)
  const commentsRef = useRef<HTMLDivElement>(null)
  const isDbPost    = !!post && isUUID(post.id)

  const { address } = useAppKitAccount()
  const { profile } = useProfile()

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
  const [replyTo,         setReplyTo]          = useState<{ parentId: string; author: string } | null>(null)
  const [editingId,       setEditingId]        = useState<string | null>(null)
  const [editValue,       setEditValue]        = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const startReply = (parentId: string, author: string) => {
    setReplyTo({ parentId, author })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const startEdit  = (c: Comment) => { setEditingId(c.id); setEditValue(c.text) }
  const cancelEdit = () => { setEditingId(null); setEditValue('') }

  const saveEdit = async (id: string) => {
    const text = editValue.trim()
    if (!text) return
    const res = await fetch('/api/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content: text }),
    })
    if (res.ok) {
      setDbComments(prev => prev.map(c => (c.id === id ? { ...c, text, edited: true } : c)))
      cancelEdit()
    }
  }

  const deleteComment = async (id: string) => {
    if (!window.confirm('Delete this comment?')) return
    const res = await fetch(`/api/comments?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return
    const { soft } = await res.json().catch(() => ({ soft: false })) as { soft?: boolean }
    setDbComments(prev =>
      soft
        ? prev.map(c => (c.id === id ? { ...c, text: '[deleted]' } : c))
        : prev.filter(c => c.id !== id),
    )
  }

  // ── Live voting (real DB voting posts) ──────────────────────────────────────
  const isRealVoting = !!post && isDbPost && post.type === 'voting'
  const [voteData,    setVoteData]    = useState(post?.voteData ?? null)
  const [voteCasting, setVoteCasting] = useState(false)
  const [voteHint,    setVoteHint]    = useState<string | null>(null)

  useEffect(() => {
    if (!isRealVoting || !post) return
    const walletParam = address ? `&wallet=${encodeURIComponent(address.toLowerCase())}` : ''
    fetch(`/api/posts/${post.id}/votes?${walletParam}`)
      .then(r => r.json())
      .then(d => setVoteData(d))
      .catch(() => {})
  }, [isRealVoting, post?.id, address])

  const castVote = async (vote: 'confirm' | 'dispute') => {
    if (!post) return
    if (!address) { setVoteHint('Connect wallet to vote'); setTimeout(() => setVoteHint(null), 2500); return }
    if (voteCasting) return
    setVoteCasting(true)
    try {
      const res = await fetch(`/api/posts/${post.id}/vote`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ wallet: address, vote }),
      })
      const d = await res.json()
      if (!res.ok) { setVoteHint(d.error ?? 'Vote failed'); setTimeout(() => setVoteHint(null), 2500); return }
      setVoteData(prev => prev
        ? { ...prev, confirmCount: d.confirmCount, disputeCount: d.disputeCount, total: d.total, userVote: d.userVote }
        : prev)
    } catch {
      setVoteHint('Vote failed'); setTimeout(() => setVoteHint(null), 2500)
    } finally {
      setVoteCasting(false)
    }
  }

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
    setReplyTo(null)

    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)

    if (isDbPost) {
      const identifier = address ?? getDeviceId()

      // Track view — deduplicated server-side (same viewer_key = no double count)
      fetch('/api/posts/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, viewer_key: identifier }),
      }).catch(() => {})

      fetch(`/api/comments?post_id=${post.id}`)
        .then(r => r.json())
        .then(({ comments }: { comments: { id: string; parent_id: string | null; author_wallet: string; content: string; created_at: string; avatar_url: string | null; edited_at?: string | null; display_name?: string | null }[] }) => {
          if (!comments) return
          const mapped = comments.map(c => ({
            id:        c.id,
            author:    c.display_name || `${c.author_wallet.slice(0, 6)}...${c.author_wallet.slice(-4)}`,
            letter:    c.author_wallet.slice(2, 3).toUpperCase(),
            av:        walletAv(c.author_wallet),
            text:      c.content,
            time:      relativeTime(c.created_at),
            wallet:    c.author_wallet,
            parentId:  c.parent_id ?? null,
            avatarUrl: c.avatar_url ?? null,
            edited:    !!c.edited_at,
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
        body: JSON.stringify({ wallet: identifier, post_id: post.id, content: commentText.trim(), parent_id: replyTo?.parentId ?? null }),
      }).catch(() => null)

      if (res?.ok) {
        const { comment } = await res.json() as { comment: { id: string; parent_id: string | null; author_wallet: string; content: string; created_at: string } }
        const newC: Comment = {
          id:        comment.id,
          author:    profile?.display_name || `${comment.author_wallet.slice(0, 6)}...${comment.author_wallet.slice(-4)}`,
          letter:    comment.author_wallet.slice(2, 3).toUpperCase(),
          av:        walletAv(comment.author_wallet),
          text:      comment.content,
          time:      'just now',
          wallet:    comment.author_wallet,
          parentId:  comment.parent_id ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        }
        setDbComments(prev => [...prev, newC])
        setNewCommentIds(prev => new Set([...prev, newC.id]))
        setRevealedIds(prev => new Set([...prev, newC.id]))
        setCommentLikes(prev => ({ ...prev, [newC.id]: { liked: false, count: 0, loading: false } }))
        setShowAllComments(true)
        setReplyTo(null)
        window.dispatchEvent(new CustomEvent('zx:onboarding', { detail: 'comment' }))
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

  // Scroll into comments when opened from the comment button
  useEffect(() => {
    if (!scrollToComments || !commentsRef.current || !panelRef.current) return
    setTimeout(() => {
      const panel    = panelRef.current!
      const comments = commentsRef.current!
      panel.scrollTo({ top: comments.offsetTop - 16, behavior: 'smooth' })
    }, 160)
  }, [scrollToComments, post?.id])

  if (!post) return null

  const votingBadge = post.type === 'voting'
    ? { background: 'rgba(201,165,90,0.1)', color: 'var(--gold)', border: '0.5px solid rgba(201,165,90,0.25)' } : {}
  const investBadge = post.type === 'investment'
    ? { background: 'rgba(138,111,201,0.12)', color: '#8a6fc9', border: '0.5px solid rgba(138,111,201,0.3)' } : {}

  // Closed voting posts show their outcome in the badge (matches the feed card):
  // passed → green "Verdict", rejected → red, no quorum → muted "Closed".
  const votingOutcome: 'verdict' | 'rejected' | 'closed' | null =
    post.type === 'voting' && voteData && !voteData.isOpen
      ? voteData.passed ? 'verdict' : voteData.void ? 'closed' : 'rejected'
      : null

  const OUTCOME_BADGE = {
    verdict:  { label: 'Verdict',  icon: 'ph-bold ph-shield-check', style: { background: 'rgba(76,175,125,0.12)', color: 'var(--green)', border: '0.5px solid rgba(76,175,125,0.3)' } },
    rejected: { label: 'Rejected', icon: 'ph-bold ph-x-circle',     style: { background: 'rgba(224,112,112,0.1)', color: 'var(--red)',   border: '0.5px solid rgba(224,112,112,0.3)' } },
    closed:   { label: 'Closed',   icon: 'ph-bold ph-minus-circle', style: { background: 'var(--surface2)',       color: 'var(--muted)', border: '0.5px solid var(--border2)' } },
  } as const

  const badgeLabel = votingOutcome ? OUTCOME_BADGE[votingOutcome].label : TYPE_LABEL[post.type]
  const badgeIcon  = votingOutcome ? OUTCOME_BADGE[votingOutcome].icon  : TYPE_ICON[post.type]
  const badgeStyle = votingOutcome ? OUTCOME_BADGE[votingOutcome].style : { ...votingBadge, ...investBadge }

  const staticComments: Comment[] = post.comments.map((c, i) => ({
    id: String(i), author: c.author, letter: c.letter, av: c.av, text: c.text, time: c.time, wallet: '', parentId: null, avatarUrl: null,
  }))
  const allComments = isDbPost ? dbComments : staticComments

  // Group into single-level threads: top-level comments + their replies.
  const topLevel = allComments.filter(c => !c.parentId)
  const repliesByParent: Record<string, Comment[]> = {}
  for (const c of allComments) {
    if (c.parentId) (repliesByParent[c.parentId] ??= []).push(c)
  }

  const myLetter = address ? address.slice(2, 3).toUpperCase() : 'U'
  const myAv     = address ? walletAv(address) : 'av-gold'

  const EMPTY_LIKE: CommentLikeState = { liked: false, count: 0, loading: false }

  const myWallet = address?.toLowerCase() ?? ''
  const ownsComment = (c: Comment) => isDbPost && !!myWallet && c.wallet?.toLowerCase() === myWallet

  const renderThread = (c: Comment, idx: number) => {
    const replies = repliesByParent[c.id] ?? []
    return (
      <div key={c.id}>
        <CommentRow
          c={c}
          idx={idx}
          isNew={newCommentIds.has(c.id)}
          revealed={revealedIds.has(c.id)}
          isDbPost={isDbPost}
          likeState={commentLikes[c.id] ?? EMPTY_LIKE}
          onLike={() => toggleCommentLike(c.id)}
          onReply={() => startReply(c.id, c.author)}
          mine={ownsComment(c)}
          editing={editingId === c.id}
          editValue={editValue}
          onEdit={() => startEdit(c)}
          onDelete={() => deleteComment(c.id)}
          onSaveEdit={() => saveEdit(c.id)}
          onCancelEdit={cancelEdit}
          onEditChange={setEditValue}
        />
        {replies.length > 0 && (
          <div style={{ marginLeft: 20, paddingLeft: 14, borderLeft: '1.5px solid var(--border)' }}>
            {replies.map((r, ri) => (
              <CommentRow
                key={r.id}
                c={r}
                idx={ri}
                isReply
                isNew={newCommentIds.has(r.id)}
                revealed={revealedIds.has(r.id)}
                isDbPost={isDbPost}
                likeState={commentLikes[r.id] ?? EMPTY_LIKE}
                onLike={() => toggleCommentLike(r.id)}
                onReply={() => startReply(c.id, r.author)}
                mine={ownsComment(r)}
                editing={editingId === r.id}
                editValue={editValue}
                onEdit={() => startEdit(r)}
                onDelete={() => deleteComment(r.id)}
                onSaveEdit={() => saveEdit(r.id)}
                onCancelEdit={cancelEdit}
                onEditChange={setEditValue}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

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
            {(() => {
              const avatar = post.avatarUrl ? (
                <img
                  src={post.avatarUrl}
                  alt={post.project}
                  style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div className={`proj-av ${post.av}`} style={{ width: 38, height: 38, fontSize: 15, borderRadius: 10 }}>
                  {post.letter}
                </div>
              )
              return post.projectSlug ? (
                <Link href={`/projects/${post.projectSlug}`} title={`View ${post.project}`} style={{ display: 'flex', flexShrink: 0 }}>
                  {avatar}
                </Link>
              ) : avatar
            })()}
            <div style={{ flex: 1, minWidth: 0 }}>
              {post.projectSlug ? (
                <Link href={`/projects/${post.projectSlug}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                  {post.project}
                </Link>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{post.project}</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{post.sub}</div>
            </div>
            <span className={`type-badge ${votingOutcome ? '' : TYPE_BADGE[post.type]}`} style={badgeStyle}>
              <i className={badgeIcon} style={{ fontSize: 9 }} /> {badgeLabel}
            </span>
            <div className="card-time" title={post.time}>{timeDisplay}</div>
          </div>

          {/* Title */}
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14, lineHeight: 1.35 }}>
            {post.title}
          </h2>

          {/* Content with clickable links */}
          <div style={{
            fontSize: 14, color: 'var(--text)', lineHeight: 1.85, marginBottom: 18,
            maxWidth: '62ch', overflowWrap: 'break-word', wordBreak: 'break-word',
            opacity: 0.9, fontWeight: 400, letterSpacing: '0.01em',
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

          {/* Vote bar — live voting on real DB voting posts */}
          {isRealVoting && voteData ? (
            <div style={{ marginBottom: 18 }}>
              {(() => {
                const cW = voteData.confirmWeight ?? voteData.confirmCount ?? 0
                const dW = voteData.disputeWeight ?? voteData.disputeCount ?? 0
                const totalW = cW + dW
                const yesPct = totalW > 0 ? Math.round((cW / totalW) * 100) : 50
                return (
                  <div className="verdict-bar">
                    <span className="vb-yes">{yesPct}%</span>
                    <div className="vb-track">
                      <div className="vb-fill-y" style={{ width: `${yesPct}%` }} />
                      <div className="vb-fill-n" style={{ width: `${100 - yesPct}%` }} />
                    </div>
                    <span className="vb-no">{100 - yesPct}%</span>
                    <span className="vb-count">{voteData.total} voters</span>
                  </div>
                )
              })()}
              {voteData.isOpen ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <button
                    className="bet-btn bb-yes"
                    onClick={() => castVote('confirm')}
                    disabled={voteCasting}
                    style={{ opacity: voteData.userVote && voteData.userVote !== 'confirm' ? 0.45 : 1 }}
                  >
                    <i className="ph-bold ph-thumbs-up" /> {isEmergencyVerdict(post.title)
                      ? verdictVoteLabel('confirm', voteData.userVote === 'confirm')
                      : voteData.userVote === 'confirm' ? 'Confirmed' : 'Confirm'}
                  </button>
                  <button
                    className="bet-btn bb-no"
                    onClick={() => castVote('dispute')}
                    disabled={voteCasting}
                    style={{ opacity: voteData.userVote && voteData.userVote !== 'dispute' ? 0.45 : 1 }}
                  >
                    <i className="ph-bold ph-thumbs-down" /> {isEmergencyVerdict(post.title)
                      ? verdictVoteLabel('dispute', voteData.userVote === 'dispute')
                      : voteData.userVote === 'dispute' ? 'Disputed' : 'Dispute'}
                  </button>
                  {voteData.timeLeft && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gold-dim)' }}>
                      <i className="ph-bold ph-clock" /> {voteData.timeLeft}
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: voteData.passed ? 'var(--green)' : 'var(--muted)' }}>
                  {voteData.passed ? '✓ Passed' : '✗ Voting closed'}
                </div>
              )}
              {voteHint && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>{voteHint}</div>
              )}

              {/* Voter list — anonymous voters are hidden by their own setting */}
              {voteData.voters && voteData.voters.length > 0 && (
                <div style={{ marginTop: 14, borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 8 }}>
                    Voters
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {voteData.voters.map((v, i) => {
                      const isConfirm = v.vote === 'confirm'
                      const label = v.anon ? 'Anonymous' : (v.name ?? (v.wallet ? `${v.wallet.slice(0, 6)}…${v.wallet.slice(-4)}` : 'Anonymous'))
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <i
                            className={`ph-bold ${isConfirm ? 'ph-thumbs-up' : 'ph-thumbs-down'}`}
                            style={{ fontSize: 12, color: isConfirm ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}
                          />
                          {v.anon || !v.wallet ? (
                            <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{label}</span>
                          ) : (
                            <Link href={`/u/${v.wallet}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                              {label}
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : post.vote ? (
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
            </div>
          ) : null}

          {/* Trust Score Change */}
          {post.trustScoreChange !== undefined && post.trustScoreChange !== 0 && (
            <div style={{ marginBottom: 18 }}>
              <span className={`score-pill ${post.trustScoreChange > 0 ? 'sp-up' : 'sp-down'}`} style={{ alignItems: 'center' }}>
                <i className={`ti ${post.trustScoreChange > 0 ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ fontSize: 12, alignSelf: 'center' }} />
                <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{post.trustScoreChange > 0 ? '+' : ''}{post.trustScoreChange}</span>
                <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.65 }}>pts Trust Score</span>
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

          {/* Stats row — views + like */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 16 }}>
            {/* Views */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px',
              fontSize: 12, color: 'var(--muted2)', opacity: 0.7 }}>
              <i className="ph-bold ph-eye" style={{ fontSize: 13 }} />
              {fmtCount(post.viewCount ?? 0)}
            </span>
            <span style={{ color: 'var(--border2)', fontSize: 11, margin: '0 2px' }}>·</span>
            {/* Like */}
            <button onClick={toggleLike} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
              color: liked ? 'var(--red)' : 'var(--muted2)', transition: 'color 0.15s',
            }}>
              <i className={`${liked ? 'ph-fill' : 'ph-bold'} ph-heart`} style={{ fontSize: 13 }} />
              {fmtCount(likeCount)}
            </button>
          </div>

          <div style={{ borderTop: '0.5px solid var(--border)', margin: '4px 0 18px' }} />

          {/* Comments */}
          <div ref={commentsRef}>
            <div style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 14 }}>
              Discussion · {allComments.length} {allComments.length === 1 ? 'comment' : 'comments'}
            </div>

            {allComments.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted2)', textAlign: 'center', padding: '8px 0 14px' }}>
                No comments yet. Be the first.
              </div>
            )}

            {topLevel.slice(0, 3).map((c, idx) => renderThread(c, idx))}

            {topLevel.length > 3 && !showAllComments && (
              <button
                onClick={() => {
                  const toReveal = new Set<string>()
                  topLevel.slice(3).forEach(c => {
                    toReveal.add(c.id)
                    ;(repliesByParent[c.id] ?? []).forEach(r => toReveal.add(r.id))
                  })
                  setRevealedIds(prev => new Set([...prev, ...toReveal]))
                  setShowAllComments(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 0',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)',
                  fontSize: 12, fontFamily: 'inherit', marginBottom: 8 }}
              >
                <i className="ph-bold ph-caret-down" style={{ fontSize: 13 }} />
                Show {topLevel.length - 3} more {topLevel.length - 3 === 1 ? 'comment' : 'comments'}
              </button>
            )}

            {showAllComments && topLevel.slice(3).map((c, idx) => renderThread(c, idx + 3))}

            {showAllComments && topLevel.length > 3 && (
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

          </div>
        </div>

        {/* Reply context chip — sits just above the composer */}
        {replyTo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderTop: '0.5px solid var(--border)', fontSize: 12, color: 'var(--muted)',
          }}>
            <i className="ph-bold ph-arrow-bend-up-left" style={{ color: 'var(--gold)', fontSize: 12 }} />
            Replying to&nbsp;<span style={{ color: 'var(--text)', fontWeight: 500 }}>{replyTo.author}</span>
            <button
              onClick={() => setReplyTo(null)}
              title="Cancel reply"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted2)', fontSize: 13, padding: 2, display: 'flex' }}
            >
              <i className="ph-bold ph-x" />
            </button>
          </div>
        )}

        {/* Composer — pinned to the bottom of the modal */}
        <div className="post-modal-foot">
          <CommentAvatar wallet={address ?? ''} letter={myLetter} av={myAv} avatarUrl={profile?.avatar_url ?? null} />
          <input
            ref={inputRef}
            className="comment-input"
            placeholder={address ? (replyTo ? `Reply to ${replyTo.author}…` : 'Add a comment…') : 'Connect wallet to comment'}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
            disabled={!address}
            style={{ flex: 1 }}
          />
          <button
            onClick={submitComment}
            disabled={!commentText.trim() || submitting || !address}
            style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              border: `0.5px solid ${commentText.trim() && address ? 'rgba(201,165,90,0.4)' : 'rgba(255,255,255,0.07)'}`,
              background: commentText.trim() && address ? 'rgba(201,165,90,0.12)' : 'rgba(255,255,255,0.03)',
              color: commentText.trim() && address ? 'var(--gold)' : 'rgba(255,255,255,0.2)',
              cursor: commentText.trim() && address ? 'pointer' : 'not-allowed', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
            <i className="ph-bold ph-paper-plane-tilt" />
          </button>
        </div>
      </div>
    </div>
  )
}
