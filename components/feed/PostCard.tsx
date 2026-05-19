'use client'

import { useState, useEffect } from 'react'
import type { FeedPost } from '@/lib/feedData'
import { supabase } from '@/lib/supabase'
import { useAppKitAccount } from '@reown/appkit/react'

interface PostCardProps {
  post:             FeedPost
  onClick:          () => void
  onCommentClick?:  () => void
  index?:           number
}

const TYPE_ICON: Record<string, string> = {
  alert: 'ph-bold ph-warning', voting: 'ph-bold ph-clock', verdict: 'ph-bold ph-shield-check',
  update: 'ph-bold ph-megaphone', new: 'ph-bold ph-sparkle', investment: 'ph-bold ph-trend-up',
}
const TYPE_LABEL: Record<string, string> = {
  alert: 'Alert', voting: 'Voting', verdict: 'Verdict',
  update: 'Update', new: 'New', investment: 'Investment',
}
const TYPE_BADGE: Record<string, string> = {
  alert: 'tb-alert', voting: '', verdict: 'tb-verdict',
  update: 'tb-update', new: 'tb-new', investment: 'tb-invest',
}
const CARD_CLASS: Record<string, string> = {
  alert: 'c-alert', voting: 'c-verdict', verdict: 'c-verdict',
  update: 'c-update', new: 'c-new', investment: 'c-invest',
}

function isUUID(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

function getDeviceId(): string {
  let id = localStorage.getItem('zx_device_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('zx_device_id', id) }
  return id
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d`
  return `${Math.floor(d / 7)}w`
}

async function doShare(post: FeedPost, setCopied: (v: boolean) => void) {
  const url = `${window.location.origin}/post/${post.id}`
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `${post.project}: ${post.title || post.type}`, text: post.text.slice(0, 120), url })
      return
    } catch { /* cancelled */ }
  }
  await navigator.clipboard.writeText(url).catch(() => {})
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

// Inline markdown: **bold**, *italic*, ~~strike~~, URLs
function InlineMd({ text, stopProp }: { text: string; stopProp?: boolean }) {
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|https?:\/\/[^\s<>"')]+)/g
  const parts: React.ReactNode[] = []
  let last = 0; let m: RegExpExecArray | null; re.lastIndex = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**'))
      parts.push(<strong key={m.index} style={{ fontWeight: 600, color: 'var(--text)' }}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('~~'))
      parts.push(<s key={m.index} style={{ opacity: 0.55 }}>{t.slice(2, -2)}</s>)
    else if (t.startsWith('*'))
      parts.push(<em key={m.index}>{t.slice(1, -1)}</em>)
    else
      parts.push(
        <a key={m.index} href={t} target="_blank" rel="noopener noreferrer"
          onClick={stopProp ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
          style={{ color: 'var(--gold)', textDecoration: 'none', wordBreak: 'break-all' }}>{t}</a>,
      )
    last = m.index + t.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

// Block renderer: > quote, # heading, 1. ordered list, inline md
function RichText({ text, stopProp }: { text: string; stopProp?: boolean }) {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let pending: { num: string; content: string }[] = []

  const flush = (key: string) => {
    if (!pending.length) return
    result.push(
      <div key={`ol-${key}`} className="rt-list">
        {pending.map((it, j) => (
          <div key={j} className="rt-list-item">
            <span className="rt-num">{it.num}</span>
            <span><InlineMd text={it.content} stopProp={stopProp} /></span>
          </div>
        ))}
      </div>,
    )
    pending = []
  }

  lines.forEach((line, i) => {
    const li = line.match(/^(\d+)\.\s+(.+)/)
    if (li) { pending.push({ num: li[1], content: li[2] }); return }
    flush(String(i))
    if (line.startsWith('> '))
      result.push(<div key={i} className="rt-blockquote"><InlineMd text={line.slice(2)} stopProp={stopProp} /></div>)
    else if (line.startsWith('# '))
      result.push(<div key={i} className="rt-h"><InlineMd text={line.slice(2)} stopProp={stopProp} /></div>)
    else
      result.push(<span key={i}><InlineMd text={line || ' '} stopProp={stopProp} />{i < lines.length - 1 && <br />}</span>)
  })
  flush('end')
  return <>{result}</>
}

export default function PostCard({ post, onClick, onCommentClick, index = 0 }: PostCardProps) {
  const isVotingOpen = post.type === 'voting' && post.vote?.open
  const isEmergency  = post.isEmergency || (post.type === 'alert')
  const isDbPost     = isUUID(post.id)

  const { address } = useAppKitAccount()
  const [liked,          setLiked]         = useState(false)
  const [likeCount,      setLikeCount]     = useState(post.likeCount ?? 0)
  const [likeAnimating,  setLikeAnimating] = useState(false)
  const [watchlisted,    setWatchlisted]   = useState(false)
  const [watchLoading,   setWatchLoading]  = useState(false)
  const [copied,         setCopied]        = useState(false)
  const [likeHint,       setLikeHint]      = useState(false)
  const [viewCount,      setViewCount]     = useState(post.viewCount ?? 0)
  const [commentsCount,  setCommentsCount] = useState(post.commentsCount ?? 0)

  useEffect(() => {
    if (!isDbPost) return
    const identifier = address ?? getDeviceId()
    fetch(`/api/posts/react?post_id=${post.id}&identifier=${encodeURIComponent(identifier)}`)
      .then(r => r.json())
      .then(({ liked: l, count }) => { setLiked(l); setLikeCount(count ?? 0) })
      .catch(() => {})
  }, [post.id, isDbPost, address])

  useEffect(() => {
    if (!isDbPost) return
    const channel = supabase
      .channel(`reactions-card-${post.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'post_reactions',
        filter: `post_id=eq.${post.id}`,
      }, () => {
        const identifier = address ?? getDeviceId()
        fetch(`/api/posts/react?post_id=${post.id}&identifier=${encodeURIComponent(identifier)}`)
          .then(r => r.json())
          .then(({ liked: l, count }) => { setLiked(!!l); if (count !== null) setLikeCount(count) })
          .catch(() => {})
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [post.id, isDbPost, address])

  // Realtime: views
  useEffect(() => {
    if (!isDbPost) return
    const ch = supabase
      .channel(`views-card-${post.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_views', filter: `post_id=eq.${post.id}` },
        () => setViewCount(c => c + 1))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [post.id, isDbPost])

  // Realtime: comments count
  useEffect(() => {
    if (!isDbPost) return
    const ch = supabase
      .channel(`comments-card-${post.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${post.id}` },
        () => setCommentsCount(c => c + 1))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_comments', filter: `post_id=eq.${post.id}` },
        () => setCommentsCount(c => Math.max(0, c - 1)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [post.id, isDbPost])

  useEffect(() => {
    if (!address || !post.projectId) return
    supabase
      .from('user_watchlist').select('project_id')
      .eq('wallet_address', address.toLowerCase()).eq('project_id', post.projectId)
      .maybeSingle().then(({ data }) => setWatchlisted(!!data))
  }, [address, post.projectId])

  const toggleWatch = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!address || !post.projectId) return
    const prev = watchlisted
    setWatchlisted(!prev); setWatchLoading(true)
    const res = await fetch('/api/watchlist', {
      method: prev ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, project_id: post.projectId }),
    }).catch(() => null)
    if (!res?.ok) setWatchlisted(prev)
    setWatchLoading(false)
  }

  const fireLikeAnim = () => { setLikeAnimating(true); setTimeout(() => setLikeAnimating(false), 620) }

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDbPost) {
      const nowLiked = !liked
      setLiked(nowLiked); setLikeCount(c => liked ? c - 1 : c + 1)
      if (nowLiked) fireLikeAnim()
      return
    }
    if (!address) { setLikeHint(true); setTimeout(() => setLikeHint(false), 2000); return }
    const wasLiked = liked; const wasCount = likeCount
    setLiked(!wasLiked); setLikeCount(wasLiked ? Math.max(0, wasCount - 1) : wasCount + 1)
    if (!wasLiked) fireLikeAnim()
    const res = await fetch('/api/posts/react', {
      method: wasLiked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, identifier: address }),
    }).catch(() => null)
    if (!res?.ok) { setLiked(wasLiked); setLikeCount(wasCount) }
    else { const d = await res.json().catch(() => null); if (d?.count !== undefined) setLikeCount(d.count) }
  }

  const votingBadge   = post.type === 'voting'     ? { background: 'rgba(201,165,90,0.1)', color: 'var(--gold)', border: '0.5px solid rgba(201,165,90,0.25)' } : {}
  const investBadge   = post.type === 'investment' ? { background: 'rgba(138,111,201,0.12)', color: '#8a6fc9', border: '0.5px solid rgba(138,111,201,0.3)' } : {}
  const votingCard    = post.type === 'voting'     ? { borderColor: 'rgba(201,165,90,0.28)', background: 'rgba(201,165,90,0.02)' } : {}
  const investCard    = post.type === 'investment' ? { borderColor: 'rgba(138,111,201,0.28)', background: 'rgba(138,111,201,0.02)' } : {}
  const emergencyCard = (isEmergency && post.isEmergency) ? { borderColor: 'rgba(224,112,112,0.5)', borderWidth: 1.5 } : {}
  const timeLabel = post.createdAt ? relativeTime(post.createdAt) : post.time

  return (
    <div
      className={`card feed-card ${CARD_CLASS[post.type]} card-stagger`}
      style={{ ...{ '--stagger': index } as React.CSSProperties, ...votingCard, ...investCard, ...emergencyCard }}
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Emergency banner */}
      {post.isEmergency && (
        <div style={{ margin: '-1px -1px 10px', padding: '6px 14px', borderRadius: '10px 10px 0 0',
          background: 'rgba(224,112,112,0.12)', borderBottom: '0.5px solid rgba(224,112,112,0.3)',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>
          <i className="ph-bold ph-warning-octagon" /> EMERGENCY CALL ACTIVE
        </div>
      )}

      {/* Header */}
      <div className="card-head">
        <div className={`proj-av ${post.av}`}>{post.letter}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {post.projectSlug ? (
              <a href={`/projects/${post.projectSlug}`} onClick={e => e.stopPropagation()} className="card-proj-link">
                {post.project}
              </a>
            ) : (
              <div className="card-proj-name">{post.project}</div>
            )}
            {!post.isEmergency && post.type !== 'alert' && !isVotingOpen && (
              <button className="card-watch-mini" onClick={toggleWatch}
                title={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                style={{ padding: 0, lineHeight: 1, flexShrink: 0 }}>
                {watchLoading
                  ? <i className="ph-bold ph-circle-notch spin" />
                  : <i className={`${watchlisted ? 'ph-fill' : 'ph-bold'} ph-bookmark-simple`} />}
              </button>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, marginTop: 2 }}>
            {post.sub}
          </div>
        </div>
        <span className={`type-badge ${TYPE_BADGE[post.type]}`} style={{ ...votingBadge, ...investBadge }}>
          <i className={TYPE_ICON[post.type]} style={{ fontSize: 9 }} /> {TYPE_LABEL[post.type]}
        </span>
        <div className="card-time">{timeLabel}</div>
      </div>

      {/* Hero image — full width */}
      {post.images && post.images.length > 0 && (
        <div className="card-hero" onClick={e => e.stopPropagation()}>
          <img src={post.images[0]} alt="" />
          {post.images.length > 1 && (
            <span className="card-hero-more">+{post.images.length - 1}</span>
          )}
        </div>
      )}

      {/* Body */}
      <div className="card-body">
        <div className="card-title">{post.title}</div>
        <div className="card-text">
          <RichText text={post.text.replace(/\n+$/, '')} stopProp />
        </div>

        {post.investment && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'rgba(138,111,201,0.12)', color: '#8a6fc9', border: '0.5px solid rgba(138,111,201,0.25)' }}>
              {post.investment.round}
            </span>
            <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--text)',
              background: 'var(--surface2)', border: '0.5px solid var(--border2)' }}>
              {post.investment.amount}
            </span>
            {post.investment.lead && (
              <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>led by {post.investment.lead}</span>
            )}
          </div>
        )}

        {post.vote && (
          <div className="verdict-bar" style={{ marginTop: 10 }}>
            <span className="vb-yes">{post.vote.yes}%</span>
            <div className="vb-track">
              <div className="vb-fill-y" style={{ width: `${post.vote.yes}%` }} />
              <div className="vb-fill-n" style={{ width: `${100 - post.vote.yes}%` }} />
            </div>
            <span className="vb-no">{100 - post.vote.yes}%</span>
            <span className="vb-count">{post.vote.count}</span>
          </div>
        )}

        {post.trustScoreChange !== undefined && post.trustScoreChange !== 0 && (
          <span className={`score-pill ${post.trustScoreChange > 0 ? 'sp-up' : 'sp-down'}`} style={{ marginTop: 8, display: 'inline-flex' }}>
            <i className={`ti ${post.trustScoreChange > 0 ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ fontSize: 11 }} />
            &nbsp;{post.trustScoreChange > 0 ? '+' : ''}{post.trustScoreChange} pts Trust Score
          </span>
        )}

        {post.score && !post.trustScoreChange && (
          <span className={`score-pill ${post.score.dir === 'up' ? 'sp-up' : 'sp-down'}`} style={{ marginTop: 8, display: 'inline-flex' }}>
            <i className={`ti ${post.score.dir === 'up' ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ fontSize: 11 }} />
            &nbsp;{post.score.delta}&nbsp;·&nbsp;Trust Score: {post.score.value}
          </span>
        )}

        {post.trust && (
          <div className="trust-mini" style={{ marginTop: 10 }}>
            <div>
              <div className="tm-num" style={{ color: post.trust.color }}>{post.trust.value}</div>
              <div className="tm-lbl">Trust Score</div>
            </div>
            <div className="tm-bar-wrap">
              <div className="tm-bar-fill" style={{ width: `${post.trust.value}%`, background: post.trust.color }} />
            </div>
          </div>
        )}
      </div>

      {/* Separator */}
      <div style={{
        height: '0.5px',
        margin: '4px 5% 0',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.13) 25%, rgba(255,255,255,0.13) 75%, transparent)',
        flexShrink: 0,
      }} />

      {/* Footer */}
      <div className="card-footer" style={{ marginTop: 0, paddingTop: 5 }}>
        {post.isEmergency && (
          <div className="foot-btn danger" style={{ flex: 1 }} onClick={e => e.stopPropagation()}>
            <i className="ph-bold ph-warning-octagon" /> Emergency Call
          </div>
        )}
        {!post.isEmergency && post.type === 'alert' && (
          <div className="foot-btn danger" onClick={e => e.stopPropagation()}>
            <i className="ph-bold ph-warning" /> Emergency Call
          </div>
        )}
        {isVotingOpen && (
          <>
            <button className="bet-btn bb-yes" style={{ fontSize: 11, padding: '5px 12px' }} onClick={e => e.stopPropagation()}>
              <i className="ph-bold ph-thumbs-up" /> Confirm
            </button>
            <button className="bet-btn bb-no" style={{ fontSize: 11, padding: '5px 12px' }} onClick={e => e.stopPropagation()}>
              <i className="ph-bold ph-thumbs-down" /> Dispute
            </button>
          </>
        )}

        {/* Views */}
        {isDbPost && (
          <span className="foot-btn" style={{ cursor: 'default', opacity: 0.55, gap: 4 }}>
            <i className="ph-bold ph-eye" style={{ fontSize: 12 }} />
            <span style={{ fontSize: 11 }}>{fmtCount(viewCount)}</span>
          </span>
        )}

        {/* Like */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            className="foot-btn"
            style={{ color: liked ? 'var(--red)' : undefined, opacity: !address && isDbPost ? 0.5 : 1 }}
            onClick={toggleLike}
            title={!address && isDbPost ? 'Connect wallet to like' : undefined}
          >
            <i className={`${liked ? 'ph-fill' : 'ph-bold'} ph-heart like-icon${likeAnimating ? ' like-pop' : ''}`} style={{ fontSize: 12 }} />
            {likeCount > 0 && <span style={{ fontSize: 11 }}>{likeCount}</span>}
          </button>
          {likeAnimating && (
            <>
              <span className="like-burst-heart like-burst-l" aria-hidden>♥</span>
              <span className="like-burst-heart like-burst-c" aria-hidden>♥</span>
              <span className="like-burst-heart like-burst-r" aria-hidden>♥</span>
            </>
          )}
          {likeHint && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
              transform: 'translateX(-50%)', whiteSpace: 'nowrap',
              background: 'var(--surface2)', border: '0.5px solid var(--border2)',
              borderRadius: 6, padding: '4px 9px', fontSize: 11, color: 'var(--muted)',
              pointerEvents: 'none', zIndex: 10,
            }}>
              Connect wallet to like
            </div>
          )}
        </div>

        {/* Comments */}
        {isDbPost && (
          <button className="foot-btn" style={{ gap: 5 }}
            onClick={e => { e.stopPropagation(); onCommentClick ? onCommentClick() : onClick() }}
            title="View comments">
            <i className="ph-bold ph-chat" style={{ fontSize: 12 }} />
            {commentsCount > 0 && <span style={{ fontSize: 11 }}>{fmtCount(commentsCount)}</span>}
          </button>
        )}

        {/* Share */}
        {isDbPost && (
          <button className="foot-btn" title={copied ? 'Copied!' : 'Share'}
            style={copied ? { color: 'var(--green)' } : {}}
            onClick={e => { e.stopPropagation(); doShare(post, setCopied) }}>
            <i className={`ph-bold ${copied ? 'ph-check' : 'ph-share-network'}`} style={{ fontSize: 12 }} />
          </button>
        )}

        {/* Read — desktop only */}
        <button className="card-read-more card-read-more-desktop" onClick={onClick}>
          Read <i className="ph-bold ph-arrow-right" />
        </button>
      </div>
    </div>
  )
}
