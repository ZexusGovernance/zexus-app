'use client'

import { useState, useEffect } from 'react'
import Nav from '@/components/nav/Nav'
import SearchOverlay from '@/components/search/SearchOverlay'
import FeedPage from '@/components/feed/FeedPage'
import ProjectsPage from '@/components/projects/ProjectsPage'
import AlertsPage from '@/components/alerts/AlertsPage'
import StakingPage from '@/components/staking/StakingPage'
import ProfilePage from '@/components/profile/ProfilePage'
import PredictPage from '@/components/predict/PredictPage'
import type { PageName } from '@/lib/types'

export default function Shell() {
  const [currentPage,    setCurrentPage]    = useState<PageName>('feed')
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [navOpen,        setNavOpen]        = useState(false)
  const [initialPostId,  setInitialPostId]  = useState<string | null>(null)

  const navigate = (page: string) => {
    setCurrentPage(page as PageName)
    setNavOpen(false)
  }

  // Handle ?post=ID deep links
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
      if (e.key === 'Escape') {
        setNavOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [searchOpen])

  const renderPage = () => {
    switch (currentPage) {
      case 'feed':     return <FeedPage onNavigate={navigate} initialPostId={initialPostId} />
      case 'projects': return <ProjectsPage onNavigate={navigate} />
      case 'alerts':   return <AlertsPage />
      case 'staking':  return <StakingPage />
      case 'profile':  return <ProfilePage />
      case 'predict':  return <PredictPage />
      default:         return <FeedPage onNavigate={navigate} initialPostId={initialPostId} />
    }
  }

  return (
    <div className="shell">
      {/* Mobile-only top bar */}
      <header className="mobile-topbar">
        <button
          className="mob-btn"
          onClick={() => setNavOpen(v => !v)}
          aria-label="Open menu"
        >
          <i className={`ti ${navOpen ? 'ti-x' : 'ti-menu-2'}`} />
        </button>
        <span className="mob-brand">ZEXUS</span>
        {!navOpen && (
          <button
            className="mob-btn mob-btn-gold"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <i className="ti ti-search" />
          </button>
        )}
      </header>

      {/* Backdrop — closes nav on tap */}
      <div
        className={`nav-backdrop${navOpen ? ' visible' : ''}`}
        onClick={() => setNavOpen(false)}
      />

      <Nav
        currentPage={currentPage}
        onNavigate={navigate}
        onSearchOpen={() => setSearchOpen(true)}
        isOpen={navOpen}
      />

      {renderPage()}

      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigate}
      />
    </div>
  )
}
