'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProfile } from '@/lib/profileContext'
import type { Notif } from '@/lib/useNotifs'

interface Props {
  address: string | undefined
  notifs: Notif[]
  unread: number
  loaded: boolean
  onMarkAll: () => void
  onMarkOne: (id: string) => void
  onOpenPost?: (postId: string) => void
  onClose: () => void
  /** anchor element — popup appears above it on desktop, below topbar on mobile */
  anchorRef: React.RefObject<HTMLElement | null>
  mobile?: boolean
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const TYPE_ICON: Record<string, string> = { verdict: '✅', alert: '⚠️', update: '📢' }

export default function NotifPopup({
  address, notifs, unread, loaded,
  onMarkAll, onMarkOne, onOpenPost, onClose,
  anchorRef, mobile,
}: Props) {
  const { profile, refreshProfile } = useProfile()
  const popupRef = useRef<HTMLDivElement>(null)

  const [tgConnected, setTgConnected] = useState(false)
  const [tgCode,      setTgCode]      = useState<string | null>(null)
  const [tgLoading,   setTgLoading]   = useState(false)
  const [style,       setStyle]       = useState<React.CSSProperties>({})

  useEffect(() => {
    setTgConnected(!!profile?.telegram_chat_id)
    if (profile?.telegram_chat_id) setTgCode(null)
  }, [profile])

  // Poll profile while code is active
  useEffect(() => {
    if (!tgCode || !address || tgConnected) return
    const id = setInterval(() => refreshProfile(address), 3000)
    return () => clearInterval(id)
  }, [tgCode, address, tgConnected, refreshProfile])

  // Position the popup
  useEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    if (mobile) {
      // Below topbar, full width with padding
      setStyle({ position: 'fixed', top: rect.bottom + 8, left: 8, right: 8 })
    } else {
      // Above anchor, same width as nav (208px with 16px side padding)
      setStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 8, left: 8, width: 224 })
    }
  }, [anchorRef, mobile])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose, anchorRef])

  async function generateCode() {
    if (!address) return
    setTgLoading(true)
    try {
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      })
      setTgCode((await res.json()).code ?? null)
    } catch { /* ignore */ }
    setTgLoading(false)
  }

  async function changeAccount() {
    if (!address) return
    setTgLoading(true)
    await fetch('/api/telegram/connect', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address }),
    })
    setTgConnected(false)
    const res = await fetch('/api/telegram/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address }),
    })
    setTgCode((await res.json()).code ?? null)
    setTgLoading(false)
  }

  function handleNotifClick(n: Notif) {
    if (!n.is_read) onMarkOne(n.id)
    if (n.post_id && onOpenPost) {
      onOpenPost(n.post_id)
      onClose()
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div ref={popupRef} className="notif-popup" style={style}>
      <div className="notif-popup-head">
        <span>Notifications</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {unread > 0 && <button className="notif-mark-all" onClick={onMarkAll}>Mark all read</button>}
          <i className="ph-bold ph-x" style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }} onClick={onClose} />
        </div>
      </div>

      <div className="notif-popup-list">
        {!address ? (
          <div className="notif-empty">Connect wallet to see notifications</div>
        ) : !loaded ? (
          <div className="notif-empty">Loading…</div>
        ) : notifs.length === 0 ? (
          <div className="notif-empty">No notifications yet.<br />Add projects to watchlist.</div>
        ) : notifs.map(n => (
          <div
            key={n.id}
            className={`notif-item${!n.is_read ? ' unread' : ''}${n.post_id ? ' clickable' : ''}`}
            onClick={() => handleNotifClick(n)}
          >
            <div className="notif-av">{TYPE_ICON[n.type] ?? '🔔'}</div>
            <div className="notif-body">
              <div className="notif-title">{n.title}</div>
              <div className="notif-desc">{n.body}</div>
              <div className="notif-time">{timeAgo(n.created_at)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="notif-popup-foot">
        {tgConnected ? (
          <>
            <div className="tg-status-row">
              <i className="ph-bold ph-telegram-logo" style={{ color: '#82b4f0', fontSize: 13 }} />
              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>Telegram connected</span>
            </div>
            <button className="tg-change-btn" onClick={changeAccount} disabled={tgLoading}>
              {tgLoading ? 'Loading…' : 'Change account'}
            </button>
          </>
        ) : (
          <button className="tg-connect-btn" onClick={generateCode} disabled={tgLoading}>
            <i className="ph-bold ph-telegram-logo"></i>
            <span>{tgLoading ? 'Loading…' : 'Connect Telegram'}</span>
          </button>
        )}
        {tgCode && (
          <div className="tg-code-box">
            Open <b>@zexusxyz_bot</b> and send:<br />
            <span className="tg-code">/connect {tgCode}</span>
            <span style={{ fontSize: 10, color: 'var(--muted2)', display: 'block', marginTop: 2 }}>Valid 10 min</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
