'use client'

import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'

interface NavProps {
  currentPage: string
  onNavigate: (page: string) => void
  onSearchOpen: () => void
  onCheckInOpen: () => void
  isOpen?: boolean
}

export default function Nav({ currentPage, onNavigate, onSearchOpen, onCheckInOpen, isOpen }: NavProps) {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { profile } = useProfile()

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null

  const zxpBalance = profile?.zxp_balance ?? 0
  const rank = profile?.rank ?? 0
  const t3Target = 600
  const toT3 = Math.max(0, t3Target - zxpBalance)
  const progress = Math.min(100, (zxpBalance / t3Target) * 100)

  return (
    <nav className={`nav nav-clean${isOpen ? ' nav-open' : ''}`}>
      <div className="nav-brand">
        <div className="nav-brand-name">ZEXUS</div>
        <div className="nav-brand-sub">Governance</div>
        <button className="nav-search" type="button" onClick={onSearchOpen} aria-label="Search">
          <i className="ph-bold ph-magnifying-glass"></i><span>Search</span><kbd>/</kbd>
        </button>
      </div>

      <div className="nav-section">Main</div>
      <div
        className={`nav-item${currentPage === 'feed' ? ' active' : ''}`}
        onClick={() => onNavigate('feed')}
      >
        <i className="ph-bold ph-squares-four nav-icon"></i> Feed
      </div>
      <div
        className={`nav-item${currentPage === 'projects' ? ' active' : ''}`}
        onClick={() => onNavigate('projects')}
      >
        <i className="ph-bold ph-buildings nav-icon"></i> Projects
      </div>
      <div
        className={`nav-item${currentPage === 'staking' ? ' active' : ''}`}
        onClick={() => onNavigate('staking')}
      >
        <i className="ph-bold ph-coin nav-icon"></i> Staking ZXP
      </div>
      <div
        className={`nav-item${currentPage === 'profile' ? ' active' : ''}`}
        onClick={() => onNavigate('profile')}
      >
        <i className="ph-bold ph-user-circle nav-icon"></i> Profile
      </div>

      <div style={{ padding: '10px 0 4px' }}>
        <div
          onClick={() => onNavigate('predict')}
          className={`nav-item${currentPage === 'predict' ? ' active' : ''}`}
        >
          <i className="ph-bold ph-trend-up nav-icon"></i>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gold)' }}>Predict</div>
            <div style={{ fontSize: '9px', color: 'var(--gold-dim)' }}>3 active events</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 0 4px' }}>
        <div
          onClick={onCheckInOpen}
          className="nav-item"
          style={{ borderColor: 'rgba(255,154,154,0.2)', background: 'rgba(255,154,154,0.05)' }}
        >
          <i className="ph-bold ph-flame nav-icon" style={{ color: '#ff9a9a' }}></i>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#ff9a9a' }}>Daily Check-in</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,154,154,0.55)' }}>
              +1 ZXP{profile?.claim_streak ? ` · day ${profile.claim_streak} streak` : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="nav-bottom">
        <div
          style={{
            background: 'var(--surface2)',
            border: '0.5px solid var(--border2)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted2)' }}>ZXP</span>
            <span style={{ fontSize: '9px', color: 'var(--muted2)' }}>
              {rank > 0 ? `Rank #${rank}` : isConnected ? '—' : 'Not connected'}
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--gold)', lineHeight: 1, marginBottom: '6px' }}>
            {zxpBalance}
          </div>
          <div style={{ height: '3px', background: 'var(--border2)', borderRadius: '2px', overflow: 'hidden', marginBottom: '5px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gold)', borderRadius: '2px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span style={{ color: 'var(--green)' }}>1.05x</span>
            <span style={{ color: 'var(--muted2)' }}>{toT3 > 0 ? `to T3: +${toT3}` : 'T3 reached!'}</span>
          </div>
        </div>
        <button
          className="wallet-pill"
          style={{ cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', background: 'none' }}
          onClick={() => open()}
          type="button"
        >
          <div className="w-dot" style={{ background: isConnected ? 'var(--green)' : 'var(--muted2)' }} />
          <span className="w-addr">
            {isConnected && shortAddr ? shortAddr : 'Connect Wallet'}
          </span>
        </button>
      </div>
    </nav>
  )
}
