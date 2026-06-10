'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAppKitAccount } from '@reown/appkit/react'
import Nav from '@/components/nav/Nav'
import NotifPopup from '@/components/notif/NotifPopup'
import SearchOverlay from '@/components/search/SearchOverlay'
import CheckInModal from '@/components/feed/CheckInModal'
import { useNotifs } from '@/lib/useNotifs'
import { AppShellContext } from '@/lib/appShell'

const PAGE_LABELS: Record<string, string> = {
  feed: 'Feed',
  projects: 'Projects',
  alerts: 'Alerts',
  staking: 'Staking',
  profile: 'Profile',
  predict: 'Predict',
  leaderboard: 'Leaderboard',
}

const BASE_NAV = [
  { page: 'staking', icon: 'ph-coin', label: 'Staking' },
  { page: 'projects', icon: 'ph-buildings', label: 'Projects' },
  { page: 'feed', icon: 'ph-squares-four', label: 'Feed' },
  { page: 'predict', icon: 'ph-trend-up', label: 'Predict' },
  { page: 'profile', icon: 'ph-user-circle', label: 'Profile' },
]

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const currentPage = pathname.split('/')[1] || 'feed'

  const [searchOpen, setSearchOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)

  const { address } = useAppKitAccount()
  const { notifs, unread, loaded, load, markAll, markOne } = useNotifs(address)
  const [mobNotifOpen, setMobNotifOpen] = useState(false)
  const mobBellRef = useRef<HTMLButtonElement>(null)

  const [userRole, setUserRole] = useState<'user' | 'project'>('user')
  const [adminProject, setAdminProject] = useState<{
    name: string
    slug?: string
  } | null>(null)
  const isProjectAdmin = userRole === 'project' && !!adminProject

  const openPost = (id: string) => router.push(`/feed?post=${id}`)

  // Role check whenever wallet changes (+ register pending referral)
  useEffect(() => {
    if (!address) {
      setUserRole('user')
      setAdminProject(null)
      return
    }
    fetch(`/api/check-role?wallet=${address}`)
      .then((r) => r.json())
      .then(
        (data: {
          role: 'user' | 'project'
          project: { name: string; slug?: string } | null
        }) => {
          setUserRole(data.role)
          setAdminProject(data.project ?? null)
        },
      )
      .catch(() => setUserRole('user'))

    const refWallet = localStorage.getItem('zexus_ref')
    if (refWallet && refWallet !== address.toLowerCase()) {
      fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referred_wallet: address,
          referrer_wallet: refWallet,
        }),
      })
        .then(() => localStorage.removeItem('zexus_ref'))
        .catch(() => {})
    }
  }, [address])

  // Capture referral code from the URL (?ref=) once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const refCode = new URLSearchParams(window.location.search).get('ref')
    if (refCode) localStorage.setItem('zexus_ref', refCode.toLowerCase())
  }, [])

  // Keyboard: "/" opens search
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

  // Nav (any context) can request the search overlay via a window event
  useEffect(() => {
    const open = () => setSearchOpen(true)
    window.addEventListener('zx:open-search', open)
    return () => window.removeEventListener('zx:open-search', open)
  }, [])

  // Center mobile-nav item becomes "Post" for project admins on the feed
  const bottomNav = BASE_NAV.map((item) => {
    if (item.page === 'feed' && currentPage === 'feed' && isProjectAdmin) {
      return { ...item, icon: 'ph-plus', label: 'Post', isCompose: true }
    }
    return { ...item, isCompose: false }
  })

  return (
    <AppShellContext.Provider
      value={{
        address,
        userRole,
        adminProject,
        isProjectAdmin,
        composeOpen,
        openCompose: () => setComposeOpen(true),
        closeCompose: () => setComposeOpen(false),
      }}
    >
      <div className="shell">
        {/* Mobile top bar */}
        <header className="mobile-topbar">
          <span className="mob-brand">ZEXUS</span>
          <span className="mob-page-title">
            {PAGE_LABELS[currentPage] ?? ''}
          </span>
          <div className="mob-topbar-actions">
            <button
              className="mob-btn mob-btn-gold"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <i className="ph-bold ph-magnifying-glass" />
            </button>
            <button
              ref={mobBellRef}
              className="mob-btn mob-btn-notif"
              style={{ position: 'relative' }}
              onClick={() => {
                if (!mobNotifOpen && !loaded) load()
                setMobNotifOpen((v) => !v)
              }}
              aria-label="Notifications"
            >
              <i className="ph-bold ph-bell" />
              {unread > 0 && <span className="mob-notif-dot" />}
            </button>
            <button
              className="mob-btn mob-btn-checkin"
              onClick={() => setCheckInOpen(true)}
              aria-label="Daily check-in"
            >
              <i className="ph-bold ph-flame" />
            </button>
          </div>
        </header>

        {mobNotifOpen && (
          <NotifPopup
            address={address}
            notifs={notifs}
            unread={unread}
            loaded={loaded}
            onMarkAll={markAll}
            onMarkOne={markOne}
            onOpenPost={(id) => {
              setMobNotifOpen(false)
              openPost(id)
            }}
            onClose={() => setMobNotifOpen(false)}
            anchorRef={mobBellRef}
            mobile
          />
        )}

        {/* Sidebar nav — desktop/tablet only */}
        <Nav />

        {children}

        {/* Mobile bottom navigation */}
        <nav className="mobile-bottom-nav" aria-label="Main navigation">
          {bottomNav.map((item) => (
            <button
              key={item.page}
              className={[
                'mob-nav-item',
                !item.isCompose && currentPage === item.page ? 'active' : '',
                item.isCompose ? 'mob-nav-compose' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() =>
                item.isCompose
                  ? setComposeOpen(true)
                  : router.push(`/${item.page}`)
              }
              aria-label={item.label}
            >
              <i className={`ph-bold ${item.icon}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {checkInOpen && <CheckInModal onClose={() => setCheckInOpen(false)} />}

        <SearchOverlay
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onNavigate={(page) => router.push(`/${page}`)}
          walletAddress={address}
          adminProjectSlug={adminProject?.slug ?? null}
        />
      </div>
    </AppShellContext.Provider>
  )
}
