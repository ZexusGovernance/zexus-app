'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'

interface NavProps {
  currentPage: string
  onNavigate: (page: string) => void
  onSearchOpen: () => void
  onCheckInOpen: () => void
  onOpenPost?: (postId: string) => void
  isOpen?: boolean
}

interface Notif {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
  post_id?: string
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const TYPE_ICON: Record<string, string> = {
  verdict: '✅',
  alert: '⚠️',
  update: '📢',
}

export default function Nav({ currentPage, onNavigate, onSearchOpen, onCheckInOpen, onOpenPost, isOpen }: NavProps) {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { profile } = useProfile()

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
  const zxpBalance = profile?.zxp_balance ?? 0
  const rank = profile?.rank ?? 0
  const t3Target = 600
  const toT3 = Math.max(0, t3Target - zxpBalance)
  const progress = Math.min(100, (zxpBalance / t3Target) * 100)

  // ── Notifications ──
  const [notifOpen,   setNotifOpen]   = useState(false)
  const [notifs,      setNotifs]      = useState<Notif[]>([])
  const [unread,      setUnread]      = useState(0)
  const [notifLoaded, setNotifLoaded] = useState(false)

  // ── Telegram ──
  const [tgConnected, setTgConnected] = useState(false)
  const [tgCode,      setTgCode]      = useState<string | null>(null)
  const [tgLoading,   setTgLoading]   = useState(false)

  const loadNotifs = useCallback(async () => {
    if (!address) return
    try {
      const res = await fetch(`/api/notifications?wallet=${address}`)
      const data = await res.json()
      setNotifs(data.notifications ?? [])
      setUnread(data.unread_count ?? 0)
      setNotifLoaded(true)
    } catch { /* ignore */ }
  }, [address])

  useEffect(() => {
    if (!address) { setUnread(0); setNotifs([]); setNotifLoaded(false); return }
    loadNotifs()
    const id = setInterval(loadNotifs, 60_000)
    return () => clearInterval(id)
  }, [address, loadNotifs])

  useEffect(() => {
    setTgConnected(!!(profile as Record<string, unknown> | null)?.telegram_chat_id)
    setTgCode(null)
  }, [profile])

  function toggleNotifPanel() {
    setNotifOpen(prev => {
      if (!prev && !notifLoaded && address) loadNotifs()
      return !prev
    })
  }

  async function markAllRead() {
    if (!address) return
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, mark_all: true }),
    })
    setNotifs(n => n.map(x => ({ ...x, is_read: true })))
    setUnread(0)
  }

  async function markOneRead(id: string) {
    if (!address) return
    setNotifs(n => n.map(x => (x.id === id ? { ...x, is_read: true } : x)))
    setUnread(u => Math.max(0, u - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, notification_id: id }),
    })
  }

  function handleNotifClick(n: Notif) {
    if (!n.is_read) markOneRead(n.id)
    if (n.post_id && onOpenPost) {
      onOpenPost(n.post_id)
      setNotifOpen(false)
    }
  }

  async function generateTgCode() {
    if (!address) return
    setTgLoading(true)
    try {
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      })
      const data = await res.json()
      setTgCode(data.code ?? null)
    } catch { /* ignore */ }
    setTgLoading(false)
  }

  async function disconnectTg() {
    if (!address) return
    await fetch('/api/telegram/connect', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address }),
    })
    setTgConnected(false)
    setTgCode(null)
  }

  async function handleChangeAccount() {
    await disconnectTg()
    await generateTgCode()
  }

  return (
    <nav className={`nav nav-clean${isOpen ? ' nav-open' : ''}`}>
      {/* ── Brand (always visible) ── */}
      <div className="nav-brand">
        <div className="nav-brand-name">ZEXUS</div>
        <div className="nav-brand-sub">Governance</div>
        {!notifOpen && (
          <button className="nav-search" type="button" onClick={onSearchOpen} aria-label="Search">
            <i className="ph-bold ph-magnifying-glass"></i><span>Search</span><kbd>/</kbd>
          </button>
        )}
      </div>

      {/* ── NOTIFICATIONS VIEW (inline, replaces nav items) ── */}
      {notifOpen ? (
        <div className="notif-inline">
          {/* Header */}
          <div className="notif-inline-head">
            <span>Notifications</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unread > 0 && (
                <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>
              )}
              <i
                className="ph-bold ph-x"
                style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
                onClick={() => setNotifOpen(false)}
              />
            </div>
          </div>

          {/* List */}
          <div className="notif-inline-list">
            {!address ? (
              <div className="notif-empty">Connect wallet to see notifications</div>
            ) : !notifLoaded ? (
              <div className="notif-empty">Loading…</div>
            ) : notifs.length === 0 ? (
              <div className="notif-empty">
                No notifications yet.<br />Add projects to watchlist to get updates.
              </div>
            ) : (
              notifs.map(n => (
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
              ))
            )}
          </div>

          {/* Telegram footer */}
          <div className="notif-inline-foot">
            {tgConnected ? (
              <>
                <div className="tg-status-row">
                  <i className="ph-bold ph-telegram-logo" style={{ color: '#82b4f0', fontSize: 14 }} />
                  <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>Telegram connected</span>
                </div>
                <button className="tg-change-btn" onClick={handleChangeAccount} disabled={tgLoading}>
                  {tgLoading ? 'Loading…' : 'Change account'}
                </button>
              </>
            ) : (
              <button className="tg-connect-btn" onClick={generateTgCode} disabled={tgLoading}>
                <i className="ph-bold ph-telegram-logo"></i>
                <span>{tgLoading ? 'Loading…' : 'Connect Telegram'}</span>
              </button>
            )}
            {tgCode && (
              <div className="tg-code-box">
                Open <b>@zexusxyz_bot</b> and send:<br />
                <span className="tg-code">/connect {tgCode}</span>
                <span style={{ fontSize: 10, color: 'var(--muted2)' }}>Valid 10 min</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── NORMAL NAV VIEW ── */
        <>
          <div className="nav-section">Main</div>
          <div className={`nav-item${currentPage === 'feed' ? ' active' : ''}`} onClick={() => onNavigate('feed')}>
            <i className="ph-bold ph-squares-four nav-icon"></i> Feed
          </div>
          <div className={`nav-item${currentPage === 'projects' ? ' active' : ''}`} onClick={() => onNavigate('projects')}>
            <i className="ph-bold ph-buildings nav-icon"></i> Projects
          </div>
          <div className={`nav-item${currentPage === 'staking' ? ' active' : ''}`} onClick={() => onNavigate('staking')}>
            <i className="ph-bold ph-coin nav-icon"></i> Staking ZXP
          </div>
          <div className={`nav-item${currentPage === 'profile' ? ' active' : ''}`} onClick={() => onNavigate('profile')}>
            <i className="ph-bold ph-user-circle nav-icon"></i> Profile
          </div>

          <div style={{ padding: '10px 0 4px' }}>
            <div onClick={() => onNavigate('predict')} className={`nav-item${currentPage === 'predict' ? ' active' : ''}`}>
              <i className="ph-bold ph-trend-up nav-icon"></i>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gold)' }}>Predict</div>
                <div style={{ fontSize: 9, color: 'var(--gold-dim)' }}>3 active events</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '0 0 4px' }}>
            <div onClick={onCheckInOpen} className="nav-item" style={{ borderColor: 'rgba(255,154,154,0.2)', background: 'rgba(255,154,154,0.05)' }}>
              <i className="ph-bold ph-flame nav-icon" style={{ color: '#ff9a9a' }}></i>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#ff9a9a' }}>Daily Check-in</div>
                <div style={{ fontSize: 9, color: 'rgba(255,154,154,0.55)' }}>
                  +1 ZXP{profile?.claim_streak ? ` · day ${profile.claim_streak} streak` : ''}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Nav bottom (always visible) ── */}
      <div className="nav-bottom">
        <div style={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted2)' }}>ZXP</span>
            <span style={{ fontSize: 9, color: 'var(--muted2)' }}>{rank > 0 ? `Rank #${rank}` : isConnected ? '—' : 'Not connected'}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--gold)', lineHeight: 1, marginBottom: 6 }}>{zxpBalance}</div>
          <div style={{ height: 3, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gold)', borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: 'var(--green)' }}>1.05x</span>
            <span style={{ color: 'var(--muted2)' }}>{toT3 > 0 ? `to T3: +${toT3}` : 'T3 reached!'}</span>
          </div>
        </div>

        <div className="notif-bell" onClick={toggleNotifPanel}>
          <div className="notif-bell-left">
            <i className="ph-bold ph-bell" style={{ fontSize: 16, width: 18, flexShrink: 0 }}></i>
            <span>Notifications</span>
          </div>
          {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
        </div>

        <button
          className="wallet-pill"
          style={{ cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', background: 'none' }}
          onClick={() => open()}
          type="button"
        >
          <div className="w-dot" style={{ background: isConnected ? 'var(--green)' : 'var(--muted2)' }} />
          <span className="w-addr">{isConnected && shortAddr ? shortAddr : 'Connect Wallet'}</span>
        </button>
      </div>
    </nav>
  )
}
