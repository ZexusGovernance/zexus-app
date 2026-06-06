'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'
import Avatar from 'boring-avatars'

const AVATAR_COLORS = ['#0a0a0f', '#3b82f6', '#a855f7', '#22d3ee', '#65bf7f']
import type { VerdictHistoryRow, DailyCheckin } from '@/lib/profile'

interface WatchlistProject {
  project_id: string
  added_at: string
  projects: {
    id: string
    slug: string
    name: string
    category: string | null
    trust_score: number
    is_verified: boolean
    avatar_url: string | null
  } | null
}

type ProfileTab = 'Activity' | 'Watchlist' | 'Settings' | 'Project'

interface AdminProject {
  name: string
  slug: string
  description: string | null
  category: string | null
  website_url: string | null
  whitepaper_url?: string | null
  github_url?: string | null
  twitter_url?: string | null
  discord_url?: string | null
  avatar_url?: string | null
  trust_score: number
  is_verified: boolean
}

function scoreClass(score: number | null) {
  if (score === null) return 'na'
  if (score >= 70) return 'hi'
  if (score >= 45) return 'mi'
  return 'lo'
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('Activity')
  const { address, isConnected } = useAppKitAccount()
  const { profile, refreshProfile } = useProfile()
  const { open } = useAppKit()

  const [verdicts, setVerdicts] = useState<VerdictHistoryRow[]>([])
  const [verdictAccuracy, setVerdictAccuracy] = useState<number | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistProject[]>([])
  const [todayCheckin, setTodayCheckin] = useState<DailyCheckin | null>(null)
  const [loading, setLoading] = useState(false)
  const [isVerifiedHolder, setIsVerifiedHolder] = useState(false)

  // Achievements
  interface AchievementRow {
    id: string; name: string; desc: string; icon: string; iconColor: string
    badgeLabel: string; unlocked: boolean; claimed: boolean
    progress: { current: number; total: number } | null
  }
  const [achievements,   setAchievements]   = useState<AchievementRow[]>([])
  const [claimingId,     setClaimingId]     = useState<string | null>(null)
  const [justClaimed,    setJustClaimed]    = useState<AchievementRow | null>(null)
  const [badgesOpen,     setBadgesOpen]     = useState(false)

  // Referrals
  const [refCount,       setRefCount]       = useState(0)
  const [refCopied,      setRefCopied]      = useState(false)

  const [watchFilter, setWatchFilter] = useState('All')

  // Project admin state
  const [adminProject,  setAdminProject]  = useState<AdminProject | null>(null)
  const [editName,      setEditName]      = useState('')
  const [editDesc,      setEditDesc]      = useState('')
  const [editCategory,  setEditCategory]  = useState('')
  const [editWebsite,   setEditWebsite]   = useState('')
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)
  const [saveSuccess,   setSaveSuccess]   = useState(false)

  // Settings — synced to profile.settings
  const s = (profile?.settings ?? {}) as Record<string, boolean>
  const [notifWatchlist, setNotifWatchlist] = useState(s.notifWatchlist ?? true)
  const [notifVerdicts, setNotifVerdicts] = useState(s.notifVerdicts ?? true)
  const [notifProjects, setNotifProjects] = useState(s.notifProjects ?? false)
  const [notifZxp, setNotifZxp] = useState(s.notifZxp ?? true)
  const [notifReplies, setNotifReplies] = useState(s.notifReplies ?? true)
  const [publicProfile, setPublicProfile] = useState(s.publicProfile ?? true)

  // Telegram bot connect (mirrors the desktop Nav footer — reachable on mobile here)
  const [tgCode,    setTgCode]    = useState<string | null>(null)
  const [tgLoading, setTgLoading] = useState(false)
  const tgConnected = !!profile?.telegram_chat_id
  const [showLeaderboard, setShowLeaderboard] = useState(s.showLeaderboard ?? true)
  const [anonVoting, setAnonVoting] = useState(s.anonVoting ?? false)

  const loadData = useCallback(async (addr: string) => {
    setLoading(true)
    try {
      const { getTodayCheckin } = await import('@/lib/profile')
      const [vh, wlRes, ci, achRes, refRes] = await Promise.all([
        fetch(`/api/profile/verdicts?wallet=${encodeURIComponent(addr)}`).then(r => r.ok ? r.json() : { history: [], accuracy: null }),
        fetch(`/api/watchlist?wallet=${encodeURIComponent(addr)}`).then(r => r.ok ? r.json() : { items: [] }),
        getTodayCheckin(addr),
        fetch(`/api/achievements?wallet=${encodeURIComponent(addr)}`).then(r => r.ok ? r.json() : { achievements: [] }),
        fetch(`/api/referral?wallet=${encodeURIComponent(addr)}`).then(r => r.ok ? r.json() : { count: 0 }),
      ])
      setVerdicts(vh.history ?? [])
      setVerdictAccuracy(vh.accuracy ?? null)
      setWatchlist(wlRes.items ?? [])
      setTodayCheckin(ci)
      setAchievements(achRes.achievements ?? [])
      setRefCount(refRes.count ?? 0)

      // Check if user has verified holding on any project
      const { supabase: sb } = await import('@/lib/supabase')
      const { count } = await sb
        .from('token_holders')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', addr.toLowerCase())
      setIsVerifiedHolder((count ?? 0) > 0)
    } catch (e) {
      console.error('loadData error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (address) loadData(address)
  }, [address, loadData])

  async function claimAchievement(ach: AchievementRow) {
    if (!address || claimingId) return
    setClaimingId(ach.id)
    try {
      const r = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, achievement_id: ach.id }),
      })
      if (!r.ok) return
      setAchievements(prev => prev.map(a => a.id === ach.id ? { ...a, claimed: true } : a))
      setJustClaimed(ach)
      setTimeout(() => setJustClaimed(null), 2800)
    } finally {
      setClaimingId(null)
    }
  }

  function copyRefLink() {
    if (!address) return
    navigator.clipboard.writeText(`https://app.zexus.xyz?ref=${address}`)
    setRefCopied(true)
    setTimeout(() => setRefCopied(false), 2000)
  }

  // Role check — detect project admin wallet
  useEffect(() => {
    if (!address) { setAdminProject(null); return }
    fetch(`/api/check-role?wallet=${address}`)
      .then(r => r.json())
      .then((data: { role: string; project: AdminProject | null }) => {
        if (data.role === 'project' && data.project) {
          setAdminProject(data.project)
          setEditName(data.project.name)
          setEditDesc(data.project.description ?? '')
          setEditCategory(data.project.category ?? '')
          setEditWebsite(data.project.website_url ?? '')
        } else {
          setAdminProject(null)
        }
      })
      .catch(() => setAdminProject(null))
  }, [address])

  // Sync settings toggles when profile loads
  useEffect(() => {
    if (!profile?.settings) return
    const s = profile.settings as Record<string, boolean>
    if (s.notifWatchlist !== undefined) setNotifWatchlist(s.notifWatchlist)
    if (s.notifVerdicts !== undefined) setNotifVerdicts(s.notifVerdicts)
    if (s.notifProjects !== undefined) setNotifProjects(s.notifProjects)
    if (s.notifZxp !== undefined) setNotifZxp(s.notifZxp)
    if (s.notifReplies !== undefined) setNotifReplies(s.notifReplies)
    if (s.publicProfile !== undefined) setPublicProfile(s.publicProfile)
    if (s.showLeaderboard !== undefined) setShowLeaderboard(s.showLeaderboard)
    if (s.anonVoting !== undefined) setAnonVoting(s.anonVoting)
  }, [profile])

  // Poll for confirmation while a code is pending
  useEffect(() => {
    if (!tgCode || !address || tgConnected) return
    const id = setInterval(() => refreshProfile(address), 3000)
    return () => clearInterval(id)
  }, [tgCode, address, tgConnected, refreshProfile])

  async function tgConnect() {
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

  async function tgChangeAccount() {
    if (!address) return
    setTgLoading(true)
    await fetch('/api/telegram/connect', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address }),
    })
    await refreshProfile(address)
    const res = await fetch('/api/telegram/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address }),
    })
    setTgCode((await res.json()).code ?? null)
    setTgLoading(false)
  }

  async function saveSetting(key: string, value: boolean) {
    if (!address) return
    const { updateSettings } = await import('@/lib/profile')
    const next = { ...(profile?.settings ?? {}), [key]: value }
    await updateSettings(address, next)
    await refreshProfile(address)
  }

  function toggle(key: string, cur: boolean, setter: (v: boolean) => void) {
    const next = !cur
    setter(next)
    saveSetting(key, next)
  }

  async function saveProject() {
    if (!address || !adminProject) return
    setSaving(true); setSaveError(null); setSaveSuccess(false)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet:      address,
          name:        editName,
          description: editDesc,
          category:    editCategory,
          website_url: editWebsite,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
  const avatarLetter = address ? address.slice(2, 3).toUpperCase() : 'U'
  const currentAvatar = profile?.avatar_url ?? null
  const isPreset = currentAvatar?.startsWith('/avatars/')
  const customAvatar = currentAvatar && !isPreset ? currentAvatar : null

  const zxpBalance = profile?.zxp_balance ?? 0
  const zxpBurned  = (profile?.zxp_burned as number) ?? 0
  const rank = profile?.rank ?? 0

  function burnRankLabel(burned: number): { label: string; color: string } | null {
    if (burned >= 10000) return { label: 'Legend',      color: '#e07070' }
    if (burned >= 2000)  return { label: 'Whale',       color: '#c97ef0' }
    if (burned >= 500)   return { label: 'Believer',    color: '#6f9be5' }
    if (burned >= 100)   return { label: 'Contributor', color: '#65bf7f' }
    return null
  }
  const burnRank = burnRankLabel(zxpBurned)
  const verdictsCount = verdicts.length
  // Accuracy is computed server-side over finalized verdicts only (matches the
  // public profile); null until at least one of the user's votes has finalized.
  const accuracy = verdictAccuracy

  const filteredWatch = watchlist.filter(w => w.projects)

  // Not connected state
  if (!isConnected || !address) {
    return (
      <div className="page active" id="page-profile">
        <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 40, opacity: 0.2 }}>
            <i className="ph-bold ph-user-circle" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Connect your wallet</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 260, textAlign: 'center', lineHeight: 1.6 }}>
            Connect your wallet to view your profile, ZXP balance, and verdict history.
          </div>
          <button
            className="wallet-pill"
            style={{ cursor: 'pointer', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 16px', background: 'var(--surface2)', fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => open()}
          >
            <div className="w-dot" style={{ background: 'var(--muted2)' }} />
            Connect Wallet
          </button>
        </div>
        <div className="right"></div>
      </div>
    )
  }

  return (
    <div className="page active" id="page-profile">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="prof-header-inner">
          <div className="prof-top">
            {address && !profile ? (
              <div className="skel skel-avatar" />
            ) : customAvatar ? (
              <img src={customAvatar} alt={avatarLetter} className="avatar ui-fade-in" style={{ objectFit: 'cover' }} />
            ) : address ? (
              <div className="avatar ui-fade-in" style={{ overflow: 'hidden', display: 'flex' }}>
                <Avatar size={56} name={address.toLowerCase()} variant="marble" colors={AVATAR_COLORS} square />
              </div>
            ) : (
              <div className="avatar">{avatarLetter}</div>
            )}
            <div style={{ flex: 1 }}>
              <div className="prof-name">{shortAddr}</div>
              <div className="prof-wallet">Connected · Base Mainnet</div>
              <div className="badge-row">
                {adminProject ? (
                  <span
                    className="badge"
                    style={{ background: 'rgba(201,165,90,0.12)', color: 'var(--gold)', border: '0.5px solid rgba(201,165,90,0.35)', cursor: 'pointer' }}
                    onClick={() => setActiveTab('Project')}
                    title="Manage project profile"
                  >
                    <i className="ph-bold ph-building" style={{ fontSize: '10px' }}></i> Admin: {adminProject.name}
                  </span>
                ) : isVerifiedHolder ? (
                  <span className="badge badge-verified">
                    <i className="ph-bold ph-shield-check" style={{ fontSize: '10px' }}></i> Verified Holder
                  </span>
                ) : null}
                {rank > 0 && (
                  <span className="badge badge-rank">
                    <i className="ph-bold ph-medal" style={{ fontSize: '10px' }}></i> Rank #{rank}
                  </span>
                )}
                <span className="badge badge-days">
                  <i className="ph-bold ph-calendar" style={{ fontSize: '10px' }}></i> {profile?.claim_streak ?? 0}-day streak
                </span>
                {zxpBurned > 0 && (
                  <span className="badge" style={{
                    background: 'rgba(224,112,112,0.1)', color: '#e07070',
                    border: '0.5px solid rgba(224,112,112,0.35)',
                  }}>
                    <i className="ph-bold ph-fire" style={{ fontSize: '10px' }}></i> {zxpBurned.toLocaleString()} ZXP burned
                  </span>
                )}
                {burnRank && (
                  <span className="badge" style={{ background: `${burnRank.color}18`, color: burnRank.color, border: `0.5px solid ${burnRank.color}55` }}>
                    <i className="ph-bold ph-fire" style={{ fontSize: '10px' }}></i> {burnRank.label}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-num gold">{Math.floor(zxpBalance)}</div>
              <div className="stat-lbl">ZXP balance</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">{verdictsCount}</div>
              <div className="stat-lbl">Verdicts</div>
            </div>
            <div className="stat-item">
              <div className="stat-num green">
                {accuracy != null ? `${accuracy}%` : '—'}
              </div>
              <div className="stat-lbl">Accuracy</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">{watchlist.length}</div>
              <div className="stat-lbl">Watchlist</div>
            </div>
          </div>
          {/* Badges collapsible section */}
          <div style={{ borderTop: '0.5px solid var(--border2)', marginTop: 2 }}>
            <button
              onClick={() => setBadgesOpen(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <i className="ph-bold ph-medal" style={{ fontSize: 13, color: 'var(--gold)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>Badges</span>
              {/* Claimed badge icon preview (collapsed) */}
              {!badgesOpen && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                  {achievements.filter(a => a.claimed).length === 0 ? (
                    <span style={{ fontSize: 10, color: 'var(--muted2)' }}>None claimed yet</span>
                  ) : (
                    achievements.filter(a => a.claimed).map(a => (
                      <div key={a.id} style={{
                        width: 20, height: 20, borderRadius: 5,
                        background: `${a.iconColor}18`, border: `0.5px solid ${a.iconColor}45`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: a.iconColor, fontSize: 11,
                      }}>
                        <i className={`ph-bold ${a.icon}`} />
                      </div>
                    ))
                  )}
                  <span style={{ fontSize: 10, color: 'var(--muted2)', marginLeft: 2 }}>
                    {achievements.filter(a => a.claimed).length}/{achievements.length}
                  </span>
                </div>
              )}
              {badgesOpen && <div style={{ flex: 1 }} />}
              <i className={`ph-bold ${badgesOpen ? 'ph-caret-up' : 'ph-caret-down'}`}
                style={{ fontSize: 10, color: 'var(--muted2)', flexShrink: 0 }} />
            </button>

            {badgesOpen && (
              <div className="prof-badges-grid" style={{ padding: '4px 14px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {achievements.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    padding: '10px 6px 8px',
                    borderRadius: 10,
                    background: a.claimed ? `${a.iconColor}0e` : 'rgba(255,255,255,0.02)',
                    border: `0.5px solid ${a.claimed ? `${a.iconColor}35` : 'rgba(255,255,255,0.06)'}`,
                    opacity: a.unlocked || a.claimed ? 1 : 0.45,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: a.claimed ? `${a.iconColor}1c` : a.unlocked ? `${a.iconColor}10` : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${a.claimed ? `${a.iconColor}45` : a.unlocked ? `${a.iconColor}28` : 'rgba(255,255,255,0.08)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17, color: a.claimed || a.unlocked ? a.iconColor : 'var(--muted2)',
                    }}>
                      {a.claimed
                        ? <i className={`ph-bold ${a.icon}`} />
                        : a.unlocked
                          ? <i className={`ph-bold ${a.icon}`} />
                          : <i className="ph-bold ph-lock" />}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: a.claimed ? a.iconColor : a.unlocked ? 'var(--text)' : 'var(--muted2)', lineHeight: 1.3 }}>
                        {a.badgeLabel}
                      </div>
                      {a.claimed && (
                        <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          <i className="ph-bold ph-check" /> Claimed
                        </div>
                      )}
                      {!a.claimed && a.unlocked && (
                        <div style={{ fontSize: 8, color: a.iconColor, marginTop: 2, fontWeight: 600 }}>
                          Ready!
                        </div>
                      )}
                      {!a.claimed && !a.unlocked && a.progress && (
                        <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 2 }}>
                          {a.progress.current}/{a.progress.total}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="tabs" id="profile-tabs">
            {(['Activity', 'Leaderboard', 'Watchlist', 'Settings', ...(adminProject ? ['Project'] : [])] as (ProfileTab | 'Leaderboard')[]).map(t => (
              <div
                key={t}
                className={`tab${activeTab === t ? ' active' : ''}`}
                onClick={() => {
                  if (t === 'Leaderboard') {
                    window.location.href = '/leaderboard'
                  } else if (t === 'Project' && adminProject?.slug) {
                    window.location.href = `/projects/${adminProject.slug}`
                  } else {
                    setActiveTab(t as ProfileTab)
                  }
                }}
              >
                {t === 'Project'
                  ? <><i className="ph-bold ph-arrow-square-out" style={{ fontSize: 11, marginRight: 4 }} />{adminProject?.name}</>
                  : t === 'Leaderboard'
                    ? <><i className="ph-bold ph-trophy" style={{ fontSize: 11, marginRight: 4 }} />Ranks</>
                    : t}
              </div>
            ))}
          </div>
        </div>

        <div className="scroll">
          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 12 }}>
              Loading...
            </div>
          )}

          {/* Activity */}
          {!loading && activeTab === 'Activity' && (
            <div id="profile-section-activity" className="ui-fade-in">
              {/* Daily check-in banner */}
              {todayCheckin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 10,
                  background: 'rgba(101,191,127,0.08)', border: '0.5px solid rgba(101,191,127,0.25)', borderRadius: 10, fontSize: 12 }}>
                  <i className="ph-bold ph-calendar-check" style={{ color: 'var(--green)', fontSize: 16 }} />
                  <span style={{ flex: 1, color: 'var(--text)' }}>
                    Checked in today · Day <strong>{todayCheckin.streak_day}</strong> streak
                  </span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>+{todayCheckin.zxp_earned} ZXP</span>
                </div>
              )}

              <div className="vhist-card">
                <div className="vhist-head">
                  <span className="vhist-title">Verdict history</span>
                  <span className="vhist-count">
                    {verdictsCount} total · {verdicts.filter(v => v.was_correct).length} correct
                  </span>
                </div>

                {verdicts.length === 0 ? (
                  <div style={{ padding: '20px 14px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
                    No verdicts yet — vote on community proposals to earn ZXP
                  </div>
                ) : (
                  verdicts.map(v => {
                    const letter = (v.post_project ?? '?').slice(0, 1).toUpperCase()
                    return (
                      <div className="vrow" key={v.id}>
                        <div
                          className="proj-av av-blue"
                          style={{ width: 28, height: 28, fontSize: 11, borderRadius: 7 }}
                        >
                          {letter}
                        </div>
                        <div className="vrow-event">
                          <div className="vrow-proj">{v.post_project ?? 'Unknown'}</div>
                          <div className="vrow-name">{v.post_title ?? 'Verdict'}</div>
                        </div>
                        <span className={`vside ${v.verdict === 'yes' ? 'vs-yes' : 'vs-no'}`}>
                          {v.verdict === 'yes' ? 'Yes' : 'No'}
                        </span>
                        {v.was_correct === null && (
                          <span className="vresult vr-pend">
                            <i className="ph-bold ph-clock" style={{ fontSize: 11 }}></i> Waiting
                          </span>
                        )}
                        {v.was_correct === true && (
                          <span className="vresult vr-ok">
                            <i className="ph-bold ph-check" style={{ fontSize: 11 }}></i> Correct
                          </span>
                        )}
                        {v.was_correct === false && (
                          <span className="vresult vr-bad">
                            <i className="ph-bold ph-x" style={{ fontSize: 11 }}></i> Wrong
                          </span>
                        )}
                        <span className={`vzxp ${v.zxp_earned > 0 ? 'earn' : v.was_correct === null ? 'pend' : 'lose'}`}>
                          {v.was_correct === null
                            ? '—'
                            : v.zxp_earned > 0
                              ? `+${v.zxp_earned} ZXP`
                              : v.zxp_earned < 0
                                ? `−${Math.abs(v.zxp_earned)} ZXP`
                                : ''}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Achievements */}
              <div className="ach-full-card" style={{ marginTop: 12 }}>
                <div className="vhist-head" style={{ padding: '12px 14px' }}>
                  <span className="vhist-title">Achievements</span>
                  <span className="vhist-count">
                    {achievements.filter(a => a.claimed).length} of {achievements.length} claimed
                  </span>
                </div>
                <div className="ach-full-list">
                  {achievements.map(a => {
                    const isClaiming = claimingId === a.id
                    return (
                      <div key={a.id} className={`ach-full-row${!a.unlocked ? ' ach-locked' : ''}`}
                        style={a.claimed ? { background: 'rgba(101,191,127,0.04)' } : undefined}>
                        <div className="ach-full-icon" style={{
                          background: a.unlocked ? `${a.iconColor}18` : 'rgba(255,255,255,0.04)',
                          border: `0.5px solid ${a.unlocked ? `${a.iconColor}40` : 'rgba(255,255,255,0.08)'}`,
                          color: a.unlocked ? a.iconColor : 'var(--muted2)',
                        }}>
                          <i className={`ph-bold ${a.icon}`} />
                        </div>
                        <div className="ach-full-body">
                          <div className="ach-full-name">{a.name}</div>
                          <div className="ach-full-desc">{a.desc}</div>
                          {a.progress && !a.claimed && (
                            <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 2, transition: 'width 0.4s',
                                  width: `${Math.round((a.progress.current / a.progress.total) * 100)}%`,
                                  background: a.unlocked ? a.iconColor : 'rgba(255,255,255,0.2)' }} />
                              </div>
                              <span style={{ fontSize: 9, color: 'var(--muted2)', flexShrink: 0 }}>
                                {a.progress.current}/{a.progress.total}
                              </span>
                            </div>
                          )}
                        </div>
                        {a.claimed ? (
                          <span className="ach-badge-ok" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <i className="ph-bold ph-check" style={{ fontSize: 9 }} /> Claimed
                          </span>
                        ) : a.unlocked ? (
                          <button
                            onClick={() => claimAchievement(a)}
                            disabled={!!claimingId}
                            style={{
                              padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                              fontFamily: 'inherit', cursor: claimingId ? 'not-allowed' : 'pointer',
                              border: `0.5px solid ${a.iconColor}55`,
                              background: `${a.iconColor}18`, color: a.iconColor,
                              opacity: isClaiming ? 0.6 : 1,
                              transition: 'opacity 0.15s, transform 0.1s',
                              transform: isClaiming ? 'scale(0.96)' : 'scale(1)',
                              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                            }}
                          >
                            {isClaiming
                              ? <><i className="ph-bold ph-circle-notch" style={{ fontSize: 11 }} /> Claiming…</>
                              : <><i className="ph-bold ph-medal" style={{ fontSize: 11 }} /> Claim Badge</>}
                          </button>
                        ) : (
                          <span className="ach-badge-lock">Locked</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Referrals */}
              <div className="ach-full-card" style={{ marginTop: 12 }}>
                <div className="vhist-head" style={{ padding: '12px 14px' }}>
                  <span className="vhist-title">Referrals</span>
                  <span className="vhist-count">{refCount} invited</span>
                </div>
                <div style={{ padding: '0 14px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 12 }}>
                    Invite friends to Zexus — earn <strong style={{ color: 'var(--gold)' }}>+5 ZXP</strong> for each of your first <strong style={{ color: 'var(--gold)' }}>3</strong> invites who join via your link. Extra invites still count toward the <strong style={{ color: '#22d3ee' }}>Recruiter</strong> badge (5 referrals) but earn no ZXP.
                  </div>
                  <button
                    onClick={copyRefLink}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 9,
                      background: refCopied ? 'rgba(101,191,127,0.12)' : 'rgba(255,255,255,0.05)',
                      border: `0.5px solid ${refCopied ? 'rgba(101,191,127,0.4)' : 'rgba(255,255,255,0.12)'}`,
                      color: refCopied ? 'var(--green)' : 'var(--text)',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      transition: 'all 0.2s',
                    }}
                  >
                    <i className={`ph-bold ${refCopied ? 'ph-check' : 'ph-link'}`} />
                    {refCopied ? 'Link copied!' : 'Copy referral link'}
                  </button>
                  {refCount > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted2)', textAlign: 'center' }}>
                      You've invited {refCount} person{refCount !== 1 ? 's' : ''} · earned {Math.min(refCount, 3) * 5} ZXP in referral rewards{refCount > 3 ? ' (reward cap reached)' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Watchlist */}
          {!loading && activeTab === 'Watchlist' && (
            <div id="profile-section-watchlist" className="ui-fade-in">
              <div className="watch-card">
                <div className="watch-tab-header" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', flex: 1 }}>
                    {watchlist.length} projects tracked
                  </span>
                  {['All'].map(f => (
                    <button
                      key={f}
                      className={`watch-filter-chip${watchFilter === f ? ' wc-active' : ''}`}
                      onClick={() => setWatchFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="vhist-head" style={{ paddingTop: 0 }}>
                  <span className="vhist-title">Watchlist</span>
                  <span className="vhist-count">{watchlist.length} projects</span>
                </div>

                {filteredWatch.length === 0 ? (
                  <div style={{ padding: '20px 14px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
                    No projects in watchlist yet — click <i className="ph-bold ph-star" /> on any post to add
                  </div>
                ) : (
                  filteredWatch.map(w => {
                    const proj = w.projects!
                    const letter = proj.name.charAt(0).toUpperCase()
                    const score = proj.trust_score
                    return (
                      <div className="wrow" key={w.project_id}>
                        {proj.avatar_url ? (
                          <img
                            src={proj.avatar_url}
                            alt={letter}
                            style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            className="proj-av av-blue"
                            style={{ width: 30, height: 30, fontSize: 12, borderRadius: 8, flexShrink: 0 }}
                          >
                            {letter}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <a
                            href={proj.slug ? `/projects/${proj.slug}` : undefined}
                            className="wrow-name"
                            style={{ textDecoration: 'none', cursor: proj.slug ? 'pointer' : 'default' }}
                            onMouseEnter={e => proj.slug && ((e.target as HTMLElement).style.color = 'var(--gold)')}
                            onMouseLeave={e => ((e.target as HTMLElement).style.color = '')}
                          >
                            {proj.name}
                          </a>
                          <div className="wrow-cat">{proj.category ?? 'DeFi'} · Base Mainnet</div>
                        </div>
                        <div className={`w-score ${scoreClass(score)}`} style={{ marginLeft: 8 }}>{score}</div>
                        <button
                          onClick={async () => {
                            if (!address) return
                            await fetch('/api/watchlist', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ wallet: address, project_id: w.project_id }),
                            })
                            setWatchlist(prev => prev.filter(x => x.project_id !== w.project_id))
                          }}
                          style={{ background: 'none', border: '0.5px solid var(--border2)', borderRadius: 6,
                            color: 'var(--muted2)', cursor: 'pointer', padding: '3px 8px', fontSize: 10,
                            fontFamily: 'inherit', marginLeft: 8, whiteSpace: 'nowrap', transition: 'color 0.14s, border-color 0.14s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(224,112,112,0.4)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)' }}
                        >
                          <i className="ph-bold ph-x" style={{ fontSize: 9, marginRight: 3 }} />Unwatch
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Settings */}
          {!loading && activeTab === 'Settings' && (
            <div id="profile-section-settings" className="ui-fade-in">
              <div className="prof-settings-section">

                {/* Avatar */}
                <div className="settings-group">
                  <div className="settings-group-title">Avatar</div>
                  <div style={{ padding: '10px 14px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    {address && (
                      <div style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>
                        <Avatar size={56} name={address.toLowerCase()} variant="marble" colors={AVATAR_COLORS} square />
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65 }}>
                      Your avatar is unique to your wallet — generated automatically.<br />
                      <span style={{ color: 'var(--muted2)' }}>No two wallets look alike.</span>
                    </div>
                  </div>
                </div>

                <div className="settings-group">
                  <div className="settings-group-title">Telegram bot</div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">
                        <i className="ph-bold ph-telegram-logo" style={{ color: '#82b4f0', marginRight: 6 }} />
                        {tgConnected ? 'Connected' : 'Connect Telegram'}
                      </div>
                      <div className="settings-row-desc">
                        {tgConnected
                          ? 'You receive enabled notifications in the bot'
                          : 'Get watchlist alerts, replies and rewards in Telegram'}
                      </div>
                    </div>
                    {tgConnected ? (
                      <button className="settings-btn" disabled={tgLoading} onClick={tgChangeAccount}>
                        {tgLoading ? '…' : 'Change'}
                      </button>
                    ) : (
                      <button
                        disabled={tgLoading || !address}
                        onClick={tgConnect}
                        style={{
                          padding: '7px 14px', borderRadius: 8, flexShrink: 0,
                          border: '0.5px solid rgba(130,180,240,0.3)',
                          background: 'rgba(130,180,240,0.08)',
                          color: '#82b4f0', fontSize: 12, fontWeight: 600,
                          cursor: address ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                        }}
                      >
                        {tgLoading ? 'Loading…' : 'Connect'}
                      </button>
                    )}
                  </div>
                  {tgCode && !tgConnected && (
                    <div style={{
                      margin: '0 14px 12px', padding: '12px 14px',
                      background: 'var(--surface2)', borderRadius: 10,
                      border: '0.5px solid var(--border)', fontSize: 12,
                      color: 'var(--muted)', lineHeight: 1.6,
                    }}>
                      Open <b style={{ color: 'var(--text)' }}>@zexusxyz_bot</b> and send:
                      <span style={{
                        fontSize: 18, fontWeight: 700, letterSpacing: 2,
                        color: 'var(--text)', fontFamily: 'monospace', display: 'block', margin: '6px 0 3px',
                        userSelect: 'all',
                      }}>
                        /connect {tgCode}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--muted2)' }}>Valid 10 min · waiting for confirmation…</span>
                    </div>
                  )}
                </div>

                <div className="settings-group">
                  <div className="settings-group-title">Notifications</div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">Watchlist alerts</div>
                      <div className="settings-row-desc">Trust Score changes and deadline events for tracked projects</div>
                    </div>
                    <div className={`settings-toggle${notifWatchlist ? ' on' : ''}`}
                      onClick={() => toggle('notifWatchlist', notifWatchlist, setNotifWatchlist)}></div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">New verdicts</div>
                      <div className="settings-row-desc">Notify when new community verdicts open for a vote</div>
                    </div>
                    <div className={`settings-toggle${notifVerdicts ? ' on' : ''}`}
                      onClick={() => toggle('notifVerdicts', notifVerdicts, setNotifVerdicts)}></div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">New projects</div>
                      <div className="settings-row-desc">Notify when new projects join the Zexus registry</div>
                    </div>
                    <div className={`settings-toggle${notifProjects ? ' on' : ''}`}
                      onClick={() => toggle('notifProjects', notifProjects, setNotifProjects)}></div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">ZXP earned</div>
                      <div className="settings-row-desc">Notify when you receive ZXP rewards</div>
                    </div>
                    <div className={`settings-toggle${notifZxp ? ' on' : ''}`}
                      onClick={() => toggle('notifZxp', notifZxp, setNotifZxp)}></div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">Comment replies</div>
                      <div className="settings-row-desc">Notify (in-app & Telegram) when someone replies to your comment</div>
                    </div>
                    <div className={`settings-toggle${notifReplies ? ' on' : ''}`}
                      onClick={() => toggle('notifReplies', notifReplies, setNotifReplies)}></div>
                  </div>
                </div>
                <div className="settings-group">
                  <div className="settings-group-title">Wallet & Network</div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">Connected wallet</div>
                      <div className="settings-row-desc">{shortAddr} · Base Mainnet</div>
                    </div>
                    <button className="settings-btn" onClick={() => open()}>Disconnect</button>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">Network</div>
                      <div className="settings-row-desc">Base Mainnet · Chain ID 8453</div>
                    </div>
                    <button className="settings-btn" onClick={() => open()}>Switch</button>
                  </div>
                </div>
                <div className="settings-group">
                  <div className="settings-group-title">Privacy</div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">Public profile</div>
                      <div className="settings-row-desc">Show your verdicts and accuracy to other users</div>
                    </div>
                    <div className={`settings-toggle${publicProfile ? ' on' : ''}`}
                      onClick={() => toggle('publicProfile', publicProfile, setPublicProfile)}></div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">Show in leaderboard</div>
                      <div className="settings-row-desc">Display your rank in the public Zexus leaderboard</div>
                    </div>
                    <div className={`settings-toggle${showLeaderboard ? ' on' : ''}`}
                      onClick={() => toggle('showLeaderboard', showLeaderboard, setShowLeaderboard)}></div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-name">Anonymous voting</div>
                      <div className="settings-row-desc">Hide your wallet address on verdict submissions</div>
                    </div>
                    <div className={`settings-toggle${anonVoting ? ' on' : ''}`}
                      onClick={() => toggle('anonVoting', anonVoting, setAnonVoting)}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Project admin */}
          {!loading && activeTab === 'Project' && adminProject && (
            <div id="profile-section-project">
              <div className="prof-settings-section">
                <div className="settings-group">
                  <div className="settings-group-title">
                    <i className="ph-bold ph-building" style={{ marginRight: 6 }} />
                    {adminProject.name} / Project Profile
                  </div>

                  <div style={{ padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">PROJECT NAME</label>
                      <input className="create-input" value={editName}
                        onChange={e => setEditName(e.target.value)} placeholder="Project name" />
                    </div>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">DESCRIPTION</label>
                      <textarea className="create-textarea" rows={3}
                        value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        placeholder="Describe your project…" />
                    </div>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">CATEGORY</label>
                      <input className="create-input" value={editCategory}
                        onChange={e => setEditCategory(e.target.value)} placeholder="e.g. AMM, DEX, Lending…" />
                    </div>
                    <div className="create-field" style={{ marginBottom: 0 }}>
                      <label className="create-label">WEBSITE URL</label>
                      <input className="create-input" value={editWebsite}
                        onChange={e => setEditWebsite(e.target.value)} placeholder="https://…" />
                    </div>

                    {saveError && (
                      <div style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="ph-bold ph-warning-circle" /> {saveError}
                      </div>
                    )}
                    {saveSuccess && (
                      <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="ph-bold ph-check-circle" /> Saved successfully
                      </div>
                    )}

                    <button
                      className="publish-btn"
                      style={{ opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                      onClick={saveProject} disabled={saving}
                    >
                      {saving
                        ? <><span className="spin"><i className="ph-bold ph-circle-notch" /></span> Saving…</>
                        : <><i className="ph-bold ph-floppy-disk" /> Save Changes</>}
                    </button>
                  </div>
                </div>

                <div className="settings-group">
                  <div className="settings-group-title">Trust Score</div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: adminProject.trust_score >= 70 ? 'var(--green)' : adminProject.trust_score >= 45 ? 'var(--amber)' : 'var(--red)' }}>
                      {adminProject.trust_score}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Current trust score — updated by post actions</div>
                    <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--border2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${adminProject.trust_score}%`, borderRadius: 2,
                        background: adminProject.trust_score >= 70 ? 'var(--green)' : adminProject.trust_score >= 45 ? 'var(--amber)' : 'var(--red)',
                        transition: 'width 0.4s' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="right"></div>

      {/* Claim achievement animation overlay */}
      {justClaimed && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(10px)',
            animation: 'zxpFadeIn 0.2s ease',
          }}
          onClick={() => setJustClaimed(null)}
        >
          <style>{`
            @keyframes zxpFadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes zxpCardPop { 0% { transform: scale(0.6) translateY(28px); opacity: 0 } 65% { transform: scale(1.05) translateY(-4px); opacity: 1 } 100% { transform: scale(1) translateY(0); opacity: 1 } }
            @keyframes zxpFloatUp { 0% { opacity: 0; transform: translateY(4px) } 18% { opacity: 1 } 80% { opacity: 0.9 } 100% { opacity: 0; transform: translateY(-72px) } }
            @keyframes zxpSpark { 0% { opacity: 1; transform: scale(0) } 60% { opacity: 0.8 } 100% { opacity: 0; transform: scale(1.2) } }
            @keyframes zxpIconPulse { 0%, 100% { filter: drop-shadow(0 0 6px currentColor) } 50% { filter: drop-shadow(0 0 20px currentColor) } }
            @keyframes zxpShimmer { 0% { opacity: 0.5 } 50% { opacity: 1 } 100% { opacity: 0.5 } }
          `}</style>

          {/* Sparkle ring */}
          {[0,30,60,90,120,150,180,210,240,270,300,330].map((angle, i) => {
            const rad = (angle * Math.PI) / 180
            const dist = 130
            return (
              <div key={i} style={{
                position: 'absolute',
                left: `calc(50% + ${Math.cos(rad) * dist}px)`,
                top:  `calc(50% + ${Math.sin(rad) * dist}px)`,
                width: i % 3 === 0 ? 10 : 6,
                height: i % 3 === 0 ? 10 : 6,
                borderRadius: i % 2 === 0 ? '50%' : 2,
                background: i % 4 === 0
                  ? justClaimed.iconColor
                  : i % 4 === 1 ? '#c9a55a'
                  : i % 4 === 2 ? '#fff'
                  : justClaimed.iconColor + 'bb',
                transform: 'translate(-50%, -50%)',
                animation: `zxpSpark 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 0.04}s both`,
              }} />
            )
          })}

          {/* Card */}
          <div
            style={{
              background: 'var(--surface)',
              border: `1.5px solid ${justClaimed.iconColor}55`,
              borderRadius: 22, padding: '36px 40px 28px', maxWidth: 320, width: '86%',
              textAlign: 'center', position: 'relative', overflow: 'visible',
              boxShadow: `0 0 0 1px ${justClaimed.iconColor}22, 0 0 50px ${justClaimed.iconColor}35, 0 24px 64px rgba(0,0,0,0.6)`,
              animation: 'zxpCardPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Floating badge label */}
            <div style={{
              position: 'absolute', top: 20, right: 28,
              fontSize: 13, fontWeight: 700,
              color: justClaimed.iconColor,
              textShadow: `0 0 14px ${justClaimed.iconColor}88`,
              animation: 'zxpFloatUp 2.4s ease-out forwards',
              pointerEvents: 'none', userSelect: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <i className={`ph-bold ${justClaimed.icon}`} style={{ fontSize: 14 }} />
              {justClaimed.badgeLabel}
            </div>

            {/* Icon */}
            <div style={{
              width: 76, height: 76, borderRadius: 20, margin: '0 auto 18px',
              background: `${justClaimed.iconColor}1a`,
              border: `2px solid ${justClaimed.iconColor}45`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 34, color: justClaimed.iconColor,
              animation: 'zxpIconPulse 1.5s ease-in-out infinite',
            }}>
              <i className={`ph-bold ${justClaimed.icon}`} />
            </div>

            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              color: justClaimed.iconColor, marginBottom: 10,
              textTransform: 'uppercase', animation: 'zxpShimmer 1.8s ease-in-out infinite',
            }}>
              Achievement Unlocked
            </div>

            <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', marginBottom: 8, lineHeight: 1.2 }}>
              {justClaimed.name}
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 24 }}>
              {justClaimed.desc}
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 22px', borderRadius: 11,
              background: `${justClaimed.iconColor}14`,
              border: `1px solid ${justClaimed.iconColor}45`,
              color: justClaimed.iconColor, fontSize: 15, fontWeight: 800,
              boxShadow: `0 0 18px ${justClaimed.iconColor}28`,
            }}>
              <i className={`ph-bold ${justClaimed.icon}`} style={{ fontSize: 15 }} />
              Badge earned!
            </div>

            <div style={{ marginTop: 18, fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.04em' }}>
              Tap anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
