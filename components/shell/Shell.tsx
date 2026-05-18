'use client'

import { useState, useEffect } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import Nav from '@/components/nav/Nav'
import SearchOverlay from '@/components/search/SearchOverlay'
import FeedPage from '@/components/feed/FeedPage'
import ProjectsPage from '@/components/projects/ProjectsPage'
import AlertsPage from '@/components/alerts/AlertsPage'
import StakingPage from '@/components/staking/StakingPage'
import ProfilePage from '@/components/profile/ProfilePage'
import PredictPage from '@/components/predict/PredictPage'
import type { PageName } from '@/lib/types'

const PAGE_LABELS: Record<string, string> = {
  feed: 'Feed', projects: 'Projects', alerts: 'Alerts',
  staking: 'Staking', profile: 'Profile', predict: 'Predict',
}

const BASE_NAV = [
  { page: 'staking',  icon: 'ti-coin',               label: 'Staking'  },
  { page: 'projects', icon: 'ti-building-community', label: 'Projects' },
  { page: 'feed',     icon: 'ti-layout-dashboard',   label: 'Feed'     },
  { page: 'predict',  icon: 'ti-chart-candle',       label: 'Predict'  },
  { page: 'profile',  icon: 'ti-user-circle',        label: 'Profile'  },
]

function CheckInModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="checkin-overlay" onClick={onClose}>
      <div className="checkin-modal" onClick={e => e.stopPropagation()}>
        <button className="checkin-close" onClick={onClose} aria-label="Close">
          <i className="ti ti-x" />
        </button>

        <div className="checkin-flame-icon">
          <i className="ti ti-flame" />
        </div>

        <div className="checkin-title">Daily Check-In</div>
        <div className="checkin-sub">Keep your streak alive</div>

        <div className="checkin-streak-row">
          <div className="checkin-streak-cell">
            <span className="checkin-streak-num">0</span>
            <span className="checkin-streak-label">day streak</span>
          </div>
          <div className="checkin-divider" />
          <div className="checkin-streak-cell">
            <span className="checkin-streak-num">0</span>
            <span className="checkin-streak-label">total days</span>
          </div>
        </div>

        <div className="checkin-reward-badge">
          <i className="ti ti-coin" style={{ fontSize: 13 }} />
          &nbsp;+10 ZXP reward
        </div>

        <button className="checkin-btn" disabled>
          <i className="ti ti-calendar-check" />
          Check In Today
        </button>
        <div className="checkin-note">Connect wallet to track your streak</div>
      </div>
    </div>
  )
}

export default function Shell() {
  const [currentPage,   setCurrentPage]   = useState<PageName>('feed')
  const [searchOpen,    setSearchOpen]    = useState(false)
  const [checkInOpen,   setCheckInOpen]   = useState(false)
  const [composeOpen,   setComposeOpen]   = useState(false)
  const [initialPostId, setInitialPostId] = useState<string | null>(null)

  const { address } = useAppKitAccount()
  const [userRole,     setUserRole]     = useState<'user' | 'project'>('user')
  const [adminProject, setAdminProject] = useState<{ name: string } | null>(null)
  const isProjectAdmin = userRole === 'project' && !!adminProject

  const navigate = (page: string) => setCurrentPage(page as PageName)

  // Role check whenever wallet changes
  useEffect(() => {
    if (!address) { setUserRole('user'); setAdminProject(null); return }
    fetch(`/api/check-role?wallet=${address}`)
      .then(r => r.json())
      .then((data: { role: 'user' | 'project'; project: { name: string } | null }) => {
        setUserRole(data.role)
        setAdminProject(data.project ?? null)
      })
      .catch(() => setUserRole('user'))
  }, [address])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const postId = params.get('post')
    if (postId) {
      setCurrentPage('feed')
      setInitialPostId(postId)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !searchOpen &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [searchOpen])

  // Center nav item becomes "Post" when user is project-admin AND on feed tab
  const bottomNav = BASE_NAV.map(item => {
    if (item.page === 'feed' && currentPage === 'feed' && isProjectAdmin) {
      return { ...item, icon: 'ti-pencil-plus', label: 'Post', isCompose: true }
    }
    return { ...item, isCompose: false }
  })

  const renderPage = () => {
    const feedPage = (
      <FeedPage
        onNavigate={navigate}
        initialPostId={initialPostId}
        composeOpen={composeOpen}
        onComposeOpen={() => setComposeOpen(true)}
        onComposeClose={() => setComposeOpen(false)}
        isProjectAdmin={isProjectAdmin}
        adminProject={adminProject}
        walletAddress={address}
      />
    )
    switch (currentPage) {
      case 'feed':     return feedPage
      case 'projects': return <ProjectsPage onNavigate={navigate} />
      case 'alerts':   return <AlertsPage />
      case 'staking':  return <StakingPage />
      case 'profile':  return <ProfilePage />
      case 'predict':  return <PredictPage />
      default:         return feedPage
    }
  }

  return (
    <div className="shell">
      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <span className="mob-page-title">{PAGE_LABELS[currentPage] ?? 'Zexus'}</span>
        <span className="mob-brand">ZEXUS</span>
        <div className="mob-topbar-actions">
          <button className="mob-btn mob-btn-gold" onClick={() => setSearchOpen(true)} aria-label="Search">
            <i className="ti ti-search" />
          </button>
          <button className="mob-btn mob-btn-checkin" onClick={() => setCheckInOpen(true)} aria-label="Daily check-in">
            <i className="ti ti-flame" />
          </button>
        </div>
      </header>

      {/* Sidebar nav — desktop/tablet only */}
      <Nav
        currentPage={currentPage}
        onNavigate={navigate}
        onSearchOpen={() => setSearchOpen(true)}
        isOpen={false}
      />

      {renderPage()}

      {/* Mobile bottom navigation */}
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {bottomNav.map(item => (
          <button
            key={item.page}
            className={[
              'mob-nav-item',
              !item.isCompose && currentPage === item.page ? 'active' : '',
              item.isCompose ? 'mob-nav-compose' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => item.isCompose ? setComposeOpen(true) : navigate(item.page)}
            aria-label={item.label}
          >
            <i className={`ti ${item.icon}`} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {checkInOpen && <CheckInModal onClose={() => setCheckInOpen(false)} />}

      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigate}
      />
    </div>
  )
}
