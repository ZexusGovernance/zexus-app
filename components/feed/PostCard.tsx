'use client'

import { useState, useEffect } from 'react'
import type { FeedPost } from '@/lib/feedData'
import { supabase } from '@/lib/supabase'
import { useAppKitAccount } from '@reown/appkit/react'

interface PostCardProps {
  post: FeedPost
  onClick: () => void
}

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
const CARD_CLASS: Record<string, string> = {
  alert: 'c-alert', voting: 'c-verdict', verdict: 'c-verdict',
  update: 'c-update', new: 'c-new', investment: 'c-invest',
}

const URL_RE = /https?:\/\/[^\s<>"')]+/g

function isUUID(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

function getDeviceId(): string {
  let id = localStorage.getItem('zx_device_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('zx_device_id', id) }
  return id
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

function LinkifiedLine({ text, stopProp }: { text: string; stopProp?: boolean }) {
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
        onClick={stopProp ? e => e.stopPropagation() : undefined}
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

function TextWithLinks({ text, stopProp }: { text: string; stopProp?: boolean }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          <LinkifiedLine text={line || ' '} stopProp={stopProp} />
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
    } catch { /* cancelled or not supported */ }
  }
  await navigator.clipboard.writeText(url).catch(() => {})
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

export default function PostCard({ post, onClick }: PostCardProps) {
  const isVotingOpen = post.type === 'voting' && post.vote?.open
  const isEmergency  = post.isEmergency || (post.type === 'alert')
  const isDbPost     = isUUID(post.id)

  const { address } = useAppKitAccount()
  const [liked,        setLiked]        = useState(false)
  const [likeCount,    setLikeCount]    = useState(post.likeCount ?? 0)
  const [watchlisted,  setWatchlisted]  = useState(false)
  const [watchLoading, setWatchLoading] = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [likeHint,     setLikeHint]     = useState(false)

  // Load initial like state from API
  useEffect(() => {
    if (!isDbPost) return
    const identifier = address ?? getDeviceId()
    fetch(`/api/posts/react?post_id=${post.id}&identifier=${encodeURIComponent(identifier)}`)
      .then(r => r.json())
      .then(({ liked: l, count }) => { setLiked(l); setLikeCount(count ?? 0) })
      .catch(() => {})
  }, [post.id, isDbPost, address])

  // Realtime subscription
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

  // Load watchlist status
  useEffect(() => {
    if (!address || !post.projectId) return
    supabase
      .from('user_watchlist')
      .select('project_id')
      .eq('wallet_address', address.toLowerCase())
      .eq('project_id', post.projectId)
      .maybeSingle()
      .then(({ data }) => setWatchlisted(!!data))
  }, [address, post.projectId])

  const toggleWatch = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!address || !post.projectId) return
    const prev = watchlisted
    setWatchlisted(!prev)
    setWatchLoading(true)
    const res = await fetch('/api/watchlist', {
      method: prev ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, project_id: post.projectId }),
    }).catch(() => null)
    if (!res?.ok) setWatchlisted(prev)
    setWatchLoading(false)
  }

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDbPost) { setLiked(v => !v); setLikeCount(c => liked ? c - 1 : c + 1); return }
    if (!address) {
      setLikeHint(true)
      setTimeout(() => setLikeHint(false), 2000)
      return
    }
    const identifier = address
    const wasLiked = liked
    const wasCount = likeCount
    setLiked(!wasLiked)
    setLikeCount(wasLiked ? Math.max(0, wasCount - 1) : wasCount + 1)

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

  const votingBadge   = post.type === 'voting'     ? { background: 'rgba(201,165,90,0.1)', color: 'var(--gold)', border: '0.5px solid rgba(201,165,90,0.25)' } : {}
  const investBadge   = post.type === 'investment' ? { background: 'rgba(138,111,201,0.12)', color: '#8a6fc9', border: '0.5px solid rgba(138,111,201,0.3)' } : {}
  const votingCard    = post.type === 'voting'     ? { borderColor: 'rgba(201,165,90,0.28)', background: 'rgba(201,165,90,0.02)' } : {}
  const investCard    = post.type === 'investment' ? { borderColor: 'rgba(138,111,201,0.28)', background: 'rgba(138,111,201,0.02)' } : {}
  const emergencyCard = (isEmergency && post.isEmergency) ? { borderColor: 'rgba(224,112,112,0.5)', borderWidth: 1.5 } : {}

  const timeLabel = post.createdAt ? relativeTime(post.createdAt) : post.time

  return (
    <div
      className={`card feed-card ${CARD_CLASS[post.type]}`}
      style={{ ...votingCard, ...investCard, ...emergencyCard }}
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Emergency banner */}
      {post.isEmergency && (
        <div style={{ margin: '-1px -1px 10px', padding: '6px 14px', borderRadius: '10px 10px 0 0',
          background: 'rgba(224,112,112,0.12)', borderBottom: '0.5px solid rgba(224,112,112,0.3)',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>
          <i className="ti ti-alert-octagon" /> EMERGENCY CALL ACTIVE
        </div>
      )}

      {/* Header */}
      <div className="card-head">
        <div className={`proj-av ${post.av}`}>{post.letter}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {post.projectSlug ? (
            <a
              href={`/projects/${post.projectSlug}`}
              onClick={e => e.stopPropagation()}
              className="card-proj-link"
            >
              {post.project}
            </a>
          ) : (
            <div className="card-proj-name">{post.project}</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.sub}
          </div>
        </div>
        <span className={`type-badge ${TYPE_BADGE[post.type]}`} style={{ ...votingBadge, ...investBadge }}>
          <i className={`ti ${TYPE_ICON[post.type]}`} style={{ fontSize: 9 }} /> {TYPE_LABEL[post.type]}
        </span>
        <div className="card-time">{timeLabel}</div>
      </div>

      {/* Body */}
      <div className="card-body">
        <div className="card-title">{post.title}</div>
        <div className="card-text">
          <TextWithLinks text={post.text} stopProp />
        </div>

        {/* Investment badge */}
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
              <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>
                led by {post.investment.lead}
              </span>
            )}
          </div>
        )}

        {/* Vote bar */}
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

        {/* Image thumbnails */}
        {post.images && post.images.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {post.images.slice(0, 3).map((url, i) => (
              <img key={i} src={url} alt="" onClick={e => e.stopPropagation()}
                style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 7, border: '0.5px solid var(--border2)', cursor: 'default' }} />
            ))}
          </div>
        )}

        {/* Trust score change — below image */}
        {post.trustScoreChange !== undefined && post.trustScoreChange !== 0 && (
          <span className={`score-pill ${post.trustScoreChange > 0 ? 'sp-up' : 'sp-down'}`} style={{ marginTop: 8, display: 'inline-flex' }}>
            <i className={`ti ${post.trustScoreChange > 0 ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ fontSize: 11 }} />
            &nbsp;{post.trustScoreChange > 0 ? '+' : ''}{post.trustScoreChange} pts Trust Score
          </span>
        )}

        {/* Legacy score pill */}
        {post.score && !post.trustScoreChange && (
          <span className={`score-pill ${post.score.dir === 'up' ? 'sp-up' : 'sp-down'}`} style={{ marginTop: 8, display: 'inline-flex' }}>
            <i className={`ti ${post.score.dir === 'up' ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ fontSize: 11 }} />
            &nbsp;{post.score.delta}&nbsp;·&nbsp;Trust Score: {post.score.value}
          </span>
        )}

        {/* Legacy trust bar */}
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

      {/* Footer */}
      <div className="card-footer">
        {post.isEmergency ? (
          <div className="foot-btn danger" style={{ flex: 1 }} onClick={e => e.stopPropagation()}>
            <i className="ti ti-alert-octagon" /> Emergency Call
          </div>
        ) : post.type === 'alert' ? (
          <div className="foot-btn danger" onClick={e => e.stopPropagation()}>
            <i className="ti ti-alert-triangle" /> Emergency Call
          </div>
        ) : isVotingOpen ? (
          <>
            <button className="bet-btn bb-yes" style={{ fontSize: 11, padding: '5px 12px' }} onClick={e => e.stopPropagation()}>
              <i className="ti ti-thumb-up" /> Confirm
            </button>
            <button className="bet-btn bb-no" style={{ fontSize: 11, padding: '5px 12px' }} onClick={e => e.stopPropagation()}>
              <i className="ti ti-thumb-down" /> Dispute
            </button>
          </>
        ) : (
          <div
            className="foot-btn"
            onClick={toggleWatch}
            style={watchlisted ? { color: 'var(--gold)', borderColor: 'rgba(201,165,90,0.4)' } : {}}
            title={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {watchLoading
              ? <i className="ti ti-loader-2 spin" style={{ fontSize: 12 }} />
              : <i className={`ti ${watchlisted ? 'ti-bookmark-filled' : 'ti-bookmark'}`} style={{ fontSize: 12 }} />}
            {watchlisted ? ' Watching' : ' Watchlist'}
          </div>
        )}

        {/* Like button */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            className="foot-btn"
            style={{
              color: liked ? 'var(--red)' : undefined,
              borderColor: liked ? 'rgba(224,112,112,0.4)' : undefined,
              gap: 5,
              opacity: !address && isDbPost ? 0.5 : 1,
            }}
            onClick={toggleLike}
            title={!address && isDbPost ? 'Connect wallet to like' : undefined}
          >
            <i className={`ti ${liked ? 'ti-heart-filled' : 'ti-heart'}`} style={{ fontSize: 12 }} />
            {likeCount > 0 && <span style={{ fontSize: 11 }}>{likeCount}</span>}
          </button>
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

        {isDbPost && (
          <button
            className="foot-btn"
            title={copied ? 'Copied!' : 'Share'}
            style={copied ? { color: 'var(--green)' } : {}}
            onClick={e => { e.stopPropagation(); doShare(post, setCopied) }}
          >
            <i className={`ti ${copied ? 'ti-check' : 'ti-share'}`} style={{ fontSize: 12 }} />
          </button>
        )}
        <button className="card-read-more card-read-more-desktop" onClick={onClick}>
          Read <i className="ti ti-arrow-right" />
        </button>
      </div>
    </div>
  )
}
