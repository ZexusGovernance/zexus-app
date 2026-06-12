'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'
import { useNotifs } from '@/lib/useNotifs'

interface NavProps {
  isOpen?: boolean
}

function openSearch() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('zx:open-search'))
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  verdict: { icon: 'ph-check-circle', color: 'var(--green)' },
  alert:   { icon: 'ph-warning',      color: 'var(--red)'   },
  update:  { icon: 'ph-megaphone',    color: '#6f9be5'      },
}

export default function Nav({ isOpen }: NavProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const isActive = (seg: string) => pathname === `/${seg}` || pathname.startsWith(`/${seg}/`)

  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { profile, refreshProfile } = useProfile()
  const { notifs, unread, loaded, load, markAll, markOne } = useNotifs(address)

  const shortAddr  = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
  const zxpBalance = profile?.zxp_balance ?? 0
  const rank       = profile?.rank ?? 0
  const t3Target   = 600
  const toT3       = Math.max(0, t3Target - zxpBalance)
  const progress   = Math.min(100, (zxpBalance / t3Target) * 100)

  const [notifOpen,  setNotifOpen]  = useState(false)
  const [tgConnected, setTgConnected] = useState(false)
  const [tgCode,      setTgCode]      = useState<string | null>(null)
  const [tgLoading,   setTgLoading]   = useState(false)

  useEffect(() => {
    setTgConnected(!!profile?.telegram_chat_id)
    if (profile?.telegram_chat_id) setTgCode(null)
  }, [profile])

  useEffect(() => {
    if (!tgCode || !address || tgConnected) return
    const id = setInterval(() => refreshProfile(address), 3000)
    return () => clearInterval(id)
  }, [tgCode, address, tgConnected, refreshProfile])

  function openNotifs() {
    if (!loaded && address) load()
    setNotifOpen(true)
  }

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

  function handleNotifClick(n: ReturnType<typeof useNotifs>['notifs'][number]) {
    if (!n.is_read) markOne(n.id)
    if (n.post_id) {
      router.push(`/feed?post=${n.post_id}`)
      setNotifOpen(false)
    }
  }

  return (
    <nav className={`nav nav-clean${isOpen ? ' nav-open' : ''}`} style={{ position: 'relative' }}>

      {/* ── Normal nav content ── */}
      <div className="nav-brand">
        <img src="/logo.svg" alt="Zexus" className="nav-logo" />
        <div className="nav-brand-name">ZEXUS</div>
      </div>

      <div className="nav-section">Main</div>
      <div className={`nav-item${isActive('feed')     ? ' active' : ''}`} onClick={() => router.push('/feed')}>
        <i className="ph-bold ph-squares-four nav-icon" /> Feed
      </div>
      <div className="nav-item" onClick={openSearch}>
        <i className="ph-bold ph-magnifying-glass nav-icon" /> Search
      </div>
      <div className={`nav-item${isActive('projects') ? ' active' : ''}`} onClick={() => router.push('/projects')}>
        <i className="ph-bold ph-buildings nav-icon" /> Projects
      </div>
      <div className={`nav-item${isActive('staking')  ? ' active' : ''}`} data-tour="nav-staking" onClick={() => router.push('/staking')}>
        <i className="ph-bold ph-coin nav-icon" /> Staking ZXP
      </div>
      <div className={`nav-item${isActive('leaderboard') ? ' active' : ''}`} onClick={() => router.push('/leaderboard')}>
        <i className="ph-bold ph-trophy nav-icon" /> Leaderboard
      </div>
      <div className={`nav-item${isActive('profile')  ? ' active' : ''}`} onClick={() => router.push('/profile')}>
        <i className="ph-bold ph-user-circle nav-icon" /> Profile
      </div>

      <div style={{ padding: '10px 0 4px' }}>
        <div onClick={() => router.push('/predict')} data-tour="nav-predict" className={`nav-item${isActive('predict') ? ' active' : ''}`}>
          <i className="ph-bold ph-trend-up nav-icon" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gold)' }}>Predict</div>
            <div style={{ fontSize: 9, color: 'var(--gold-dim)' }}>3 active events</div>
          </div>
        </div>
      </div>

      <div className="nav-bottom">
        {/* ZXP card */}
        <div style={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted2)' }}>ZXP</span>
            <span style={{ fontSize: 9, color: 'var(--muted2)' }}>{rank > 0 ? `Rank #${rank}` : isConnected ? '—' : 'Not connected'}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--gold)', lineHeight: 1, marginBottom: 6 }}>{Math.floor(zxpBalance)}</div>
          <div style={{ height: 3, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gold)', borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: 'var(--green)' }}>1.05x</span>
            <span style={{ color: 'var(--muted2)' }}>{toT3 > 0 ? `to T3: +${toT3}` : 'T3 reached!'}</span>
          </div>
        </div>

        {/* Bell button */}
        <div
          className={`notif-bell${notifOpen ? ' active' : ''}`}
          onClick={openNotifs}
          style={{ cursor: 'pointer' }}
        >
          <div className="notif-bell-left">
            <i className="ph-bold ph-bell" style={{ fontSize: 16, width: 18, flexShrink: 0 }} />
            <span>Notifications</span>
          </div>
          {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
        </div>

        {/* Wallet */}
        <button
          className="wallet-pill"
          style={{ cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', background: 'none' }}
          onClick={() => open()}
          type="button"
        >
          <div className="w-dot" style={{ background: isConnected ? 'var(--green)' : 'var(--muted2)' }} />
          <span className="w-addr">{isConnected ? (shortAddr ?? 'Connected') : 'Connect Wallet'}</span>
        </button>
      </div>

      {/* ── Notification panel (in-sidebar overlay) ── */}
      {notifOpen && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '18px 16px 14px',
            borderBottom: '0.5px solid var(--border)',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setNotifOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', padding: '2px 6px 2px 0', fontSize: 13,
              }}
              aria-label="Back"
            >
              <i className="ph-bold ph-arrow-left" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted2)', fontSize: 11, fontFamily: 'inherit',
                  padding: '2px 4px',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {!address ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
                Connect wallet to see notifications
              </div>
            ) : !loaded ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted2)', fontSize: 12 }}>
                <i className="ph-bold ph-circle-notch spin" style={{ fontSize: 16, display: 'block', marginBottom: 6 }} />
                Loading…
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12, lineHeight: 1.7 }}>
                <i className="ph-bold ph-bell-slash" style={{ fontSize: 22, display: 'block', marginBottom: 8, opacity: 0.3 }} />
                No notifications yet.<br />Add projects to watchlist.
              </div>
            ) : (
              notifs.map(n => {
                const iconCfg = TYPE_ICON[n.type] ?? { icon: 'ph-bell', color: 'var(--muted)' }
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    style={{
                      display: 'flex', gap: 10, padding: '11px 16px',
                      cursor: n.post_id ? 'pointer' : 'default',
                      background: !n.is_read ? 'rgba(111,155,229,0.06)' : 'transparent',
                      borderBottom: '0.5px solid var(--border)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (n.post_id) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = !n.is_read ? 'rgba(111,155,229,0.06)' : 'transparent' }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: 'var(--surface2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className={`ph-bold ${iconCfg.icon}`} style={{ fontSize: 13, color: iconCfg.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: !n.is_read ? 'var(--text)' : 'var(--muted)',
                        lineHeight: 1.4,
                      }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
                        {n.body}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 3 }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                    {!n.is_read && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6f9be5', flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Telegram footer */}
          <div style={{
            padding: '12px 16px',
            borderTop: '0.5px solid var(--border)',
            flexShrink: 0,
          }}>
            {tgConnected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <i className="ph-bold ph-telegram-logo" style={{ color: '#82b4f0', fontSize: 13 }} />
                  <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>Telegram connected</span>
                </div>
                <button
                  onClick={changeAccount}
                  disabled={tgLoading}
                  style={{
                    width: '100%', padding: '7px 12px', borderRadius: 8,
                    border: '0.5px solid var(--border2)', background: 'rgba(255,255,255,0.03)',
                    color: 'var(--muted)', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {tgLoading ? 'Loading…' : 'Change account'}
                </button>
              </>
            ) : (
              <button
                onClick={generateCode}
                disabled={tgLoading}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '0.5px solid rgba(130,180,240,0.25)',
                  background: 'rgba(130,180,240,0.06)',
                  color: '#82b4f0', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                <i className="ph-bold ph-telegram-logo" />
                {tgLoading ? 'Loading…' : 'Connect Telegram'}
              </button>
            )}
            {tgCode && (
              <div style={{
                marginTop: 10, padding: '10px 12px',
                background: 'var(--surface2)', borderRadius: 8,
                border: '0.5px solid var(--border)', fontSize: 11,
                color: 'var(--muted)', lineHeight: 1.6,
              }}>
                Open <b style={{ color: 'var(--text)' }}>@zexusxyz_bot</b> and send:<br />
                <span style={{
                  fontSize: 17, fontWeight: 700, letterSpacing: 2,
                  color: 'var(--text)', fontFamily: 'monospace', display: 'block', margin: '4px 0 2px',
                }}>
                  /connect {tgCode}
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted2)' }}>Valid 10 min · waiting for confirmation…</span>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
