'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useProfile } from '@/lib/profileContext'
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
  const [watchlist, setWatchlist] = useState<WatchlistProject[]>([])
  const [todayCheckin, setTodayCheckin] = useState<DailyCheckin | null>(null)
  const [loading, setLoading] = useState(false)

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
  const [publicProfile, setPublicProfile] = useState(s.publicProfile ?? true)
  const [showLeaderboard, setShowLeaderboard] = useState(s.showLeaderboard ?? true)
  const [anonVoting, setAnonVoting] = useState(s.anonVoting ?? false)

  const loadData = useCallback(async (addr: string) => {
    setLoading(true)
    try {
      const { getVerdictHistory, getTodayCheckin } = await import('@/lib/profile')
      const [vh, wlRes, ci] = await Promise.all([
        getVerdictHistory(addr),
        fetch(`/api/watchlist?wallet=${encodeURIComponent(addr)}`).then(r => r.ok ? r.json() : { items: [] }),
        getTodayCheckin(addr),
      ])
      setVerdicts(vh)
      setWatchlist(wlRes.items ?? [])
      setTodayCheckin(ci)
    } catch (e) {
      console.error('loadData error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (address) loadData(address)
  }, [address, loadData])

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
    if (s.publicProfile !== undefined) setPublicProfile(s.publicProfile)
    if (s.showLeaderboard !== undefined) setShowLeaderboard(s.showLeaderboard)
    if (s.anonVoting !== undefined) setAnonVoting(s.anonVoting)
  }, [profile])

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

  const zxpBalance = profile?.zxp_balance ?? 0
  const rank = profile?.rank ?? 0
  const verdictsCount = verdicts.length
  const accuracy = verdictsCount > 0
    ? Math.round((verdicts.filter(v => v.was_correct).length / verdictsCount) * 100)
    : 0

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
            <div className="avatar">{avatarLetter}</div>
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
                ) : (
                  <span className="badge badge-verified">
                    <i className="ph-bold ph-shield-check" style={{ fontSize: '10px' }}></i> Verified Holder
                  </span>
                )}
                {rank > 0 && (
                  <span className="badge badge-rank">
                    <i className="ph-bold ph-medal" style={{ fontSize: '10px' }}></i> Rank #{rank}
                  </span>
                )}
                <span className="badge badge-days">
                  <i className="ph-bold ph-calendar" style={{ fontSize: '10px' }}></i> {profile?.claim_streak ?? 0}-day streak
                </span>
              </div>
            </div>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-num gold">{zxpBalance}</div>
              <div className="stat-lbl">ZXP balance</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">{verdictsCount}</div>
              <div className="stat-lbl">Verdicts</div>
            </div>
            <div className="stat-item">
              <div className="stat-num green">
                {verdictsCount > 0 ? `${Math.round(accuracy)}%` : '—'}
              </div>
              <div className="stat-lbl">Accuracy</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">{watchlist.length}</div>
              <div className="stat-lbl">Watchlist</div>
            </div>
          </div>
          <div className="tabs" id="profile-tabs">
            {(['Activity', 'Watchlist', 'Settings', ...(adminProject ? ['Project'] : [])] as ProfileTab[]).map(t => (
              <div
                key={t}
                className={`tab${activeTab === t ? ' active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t === 'Project' ? <><i className="ph-bold ph-building" style={{ fontSize: 11, marginRight: 4 }} />{adminProject?.name}</> : t}
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
            <div id="profile-section-activity">
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
                          {v.was_correct === null ? '—' : v.zxp_earned > 0 ? `+${v.zxp_earned} ZXP` : `−${Math.abs(v.zxp_earned)} ZXP`}
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
                    {[zxpBalance > 0, verdictsCount > 0, (profile?.claim_streak ?? 0) >= 7].filter(Boolean).length} of 6 unlocked
                  </span>
                </div>
                <div className="ach-full-list">
                  <div className={`ach-full-row${verdictsCount === 0 ? ' ach-locked' : ''}`}>
                    <div className={`ach-full-icon ${verdictsCount > 0 ? 'ai-gold' : 'ai-gray'}`}>
                      <i className="ph-bold ph-shield-check"></i>
                    </div>
                    <div className="ach-full-body">
                      <div className="ach-full-name">First verdict</div>
                      <div className="ach-full-desc">Cast your first community verdict</div>
                    </div>
                    <span className={verdictsCount > 0 ? 'ach-badge-ok' : 'ach-badge-lock'}>
                      {verdictsCount > 0 ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <div className={`ach-full-row${zxpBalance === 0 ? ' ach-locked' : ''}`}>
                    <div className={`ach-full-icon ${zxpBalance > 0 ? 'ai-blue' : 'ai-gray'}`}>
                      <i className="ph-bold ph-coin"></i>
                    </div>
                    <div className="ach-full-body">
                      <div className="ach-full-name">First stake</div>
                      <div className="ach-full-desc">Lock ZXP in the staking pool for the first time</div>
                    </div>
                    <span className={zxpBalance > 0 ? 'ach-badge-ok' : 'ach-badge-lock'}>
                      {zxpBalance > 0 ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <div className={`ach-full-row${(profile?.claim_streak ?? 0) < 7 ? ' ach-locked' : ''}`}>
                    <div className={`ach-full-icon ${(profile?.claim_streak ?? 0) >= 7 ? 'ai-green' : 'ai-gray'}`}>
                      <i className="ph-bold ph-calendar-check"></i>
                    </div>
                    <div className="ach-full-body">
                      <div className="ach-full-name">7-day streak</div>
                      <div className="ach-full-desc">Check in every day for 7 days in a row</div>
                    </div>
                    <span className={(profile?.claim_streak ?? 0) >= 7 ? 'ach-badge-ok' : 'ach-badge-lock'}>
                      {(profile?.claim_streak ?? 0) >= 7 ? 'Unlocked' : `${(profile?.claim_streak ?? 0)} / 7`}
                    </span>
                  </div>
                  <div className="ach-full-row ach-locked">
                    <div className="ach-full-icon ai-gray"><i className="ph-bold ph-trophy"></i></div>
                    <div className="ach-full-body">
                      <div className="ach-full-name">Genesis Tier</div>
                      <div className="ach-full-desc">Reach Genesis Tier 3 — need 600 ZXP total</div>
                    </div>
                    <span className={zxpBalance >= 600 ? 'ach-badge-ok' : 'ach-badge-lock'}>
                      {zxpBalance >= 600 ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <div className="ach-full-row ach-locked">
                    <div className="ach-full-icon ai-gray"><i className="ph-bold ph-star"></i></div>
                    <div className="ach-full-body">
                      <div className="ach-full-name">100 verdicts</div>
                      <div className="ach-full-desc">Submit 100 community verdicts</div>
                    </div>
                    <span className="ach-badge-lock">{verdictsCount} / 100</span>
                  </div>
                  <div className="ach-full-row ach-locked">
                    <div className="ach-full-icon ai-gray"><i className="ph-bold ph-users"></i></div>
                    <div className="ach-full-body">
                      <div className="ach-full-name">5 referrals</div>
                      <div className="ach-full-desc">Invite 5 verified holders to Zexus</div>
                    </div>
                    <span className="ach-badge-lock">0 / 5</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Watchlist */}
          {!loading && activeTab === 'Watchlist' && (
            <div id="profile-section-watchlist">
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
                    No projects in watchlist yet — click <i className="ph-bold ph-bookmark" /> on any post to add
                  </div>
                ) : (
                  filteredWatch.map(w => {
                    const proj = w.projects!
                    const letter = proj.name.charAt(0).toUpperCase()
                    const score = proj.trust_score
                    return (
                      <div className="wrow" key={w.project_id}>
                        <div
                          className="proj-av av-blue"
                          style={{ width: 30, height: 30, fontSize: 12, borderRadius: 8, flexShrink: 0 }}
                        >
                          {letter}
                        </div>
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
            <div id="profile-section-settings">
              <div className="prof-settings-section">
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
                    {adminProject.name} — Project Profile
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
    </div>
  )
}
