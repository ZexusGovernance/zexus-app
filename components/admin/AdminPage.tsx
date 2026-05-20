'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'

const SUPER_ADMIN = (process.env.NEXT_PUBLIC_SUPER_ADMIN_WALLET ?? '').toLowerCase()

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreInputs {
  twitter_followers:   number
  discord_members:     number
  github_commits_30d:  number
  product_stage:       'none' | 'testnet' | 'mainnet'
  has_whitepaper:      boolean
  has_audit:           boolean
  onchain_wallets:     number
  onchain_tvl:         number
  team_doxxed:         boolean
  has_investors:       boolean
  contract_age_months: number
  has_partnerships:    boolean
  has_cex_listing:     boolean
  has_foundation_grant: boolean
  has_media_mentions:  boolean
  has_hackathon_win:   boolean
  has_top_integration: boolean
}

interface Project {
  id:           string
  name:         string
  slug:         string
  category:     string | null
  description:  string | null
  admin_wallet: string | null
  website_url:  string | null
  github_url:   string | null
  trust_score:  number
  is_verified:  boolean
  has_token:    boolean
  show_holders: boolean
  show_votes:   boolean
  avatar_url:   string | null
  created_at:   string
  contract_address:     string | null
  twitter_followers:    number
  discord_members:      number
  github_commits_30d:   number
  product_stage:        string
  has_whitepaper:       boolean
  has_audit:            boolean
  team_doxxed:          boolean
  has_investors:        boolean
  has_partnerships:     boolean
  has_cex_listing:      boolean
  has_foundation_grant: boolean
  has_media_mentions:   boolean
  has_hackathon_win:    boolean
  has_top_integration:  boolean
  onchain_wallets:      number
  onchain_tvl:          number
  contract_age_months:  number
}

// ── Score calculation ─────────────────────────────────────────────────────────

const SCORE_DEFAULTS: ScoreInputs = {
  twitter_followers: 0, discord_members: 0, github_commits_30d: 0,
  product_stage: 'none', has_whitepaper: false, has_audit: false,
  onchain_wallets: 0, onchain_tvl: 0,
  team_doxxed: false, has_investors: false,
  contract_age_months: 0, has_partnerships: false,
  has_cex_listing: false, has_foundation_grant: false,
  has_media_mentions: false, has_hackathon_win: false, has_top_integration: false,
}

function calcScore(s: ScoreInputs) {
  let social = 0
  if (s.twitter_followers >= 20000) social += 15
  else if (s.twitter_followers >= 5000) social += 10
  else if (s.twitter_followers >= 1000) social += 5
  if (s.discord_members >= 1000) social += 5
  else if (s.discord_members >= 100) social += 3
  if (s.github_commits_30d >= 50) social += 5
  else if (s.github_commits_30d >= 11) social += 4
  else if (s.github_commits_30d >= 1) social += 2
  social = Math.min(social, 25)

  let product = 0
  if (s.product_stage === 'mainnet') product += 15
  else if (s.product_stage === 'testnet') product += 7
  if (s.has_whitepaper) product += 3
  if (s.has_audit) product += 12
  product = Math.min(product, 25)

  let onchain = 0
  if (s.onchain_wallets >= 10000) onchain += 15
  else if (s.onchain_wallets >= 1000) onchain += 10
  else if (s.onchain_wallets >= 100) onchain += 4
  if (s.onchain_tvl >= 1000000) onchain += 5
  else if (s.onchain_tvl >= 100000) onchain += 3
  onchain = Math.min(onchain, 20)

  let team = 0
  if (s.team_doxxed) team += 8
  if (s.has_investors) team += 7
  team = Math.min(team, 15)

  let track = 0
  if (s.contract_age_months >= 12) track += 10
  else if (s.contract_age_months >= 6) track += 5
  if (s.has_partnerships) track += 5
  track = Math.min(track, 15)

  let bonus = 0
  if (s.has_cex_listing) bonus += 4
  if (s.has_foundation_grant) bonus += 3
  if (s.has_media_mentions) bonus += 3
  if (s.has_hackathon_win) bonus += 2
  if (s.has_top_integration) bonus += 3
  bonus = Math.min(bonus, 10)

  return { social, product, onchain, team, track, bonus, total: social + product + onchain + team + track + bonus }
}

function scoreColor(n: number) {
  if (n >= 70) return 'var(--green)'
  if (n >= 45) return '#f0c060'
  return 'var(--red)'
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── ScoreBuilder ──────────────────────────────────────────────────────────────

function ScoreBuilder({
  inputs, onChange,
  contractAddress, onContractChange,
  githubUrl, onGithubUrlChange,
  onGithubFetch, fetching, fetchErr,
}: {
  inputs: ScoreInputs
  onChange: (k: keyof ScoreInputs, v: unknown) => void
  contractAddress: string
  onContractChange: (v: string) => void
  githubUrl: string
  onGithubUrlChange: (v: string) => void
  onGithubFetch: () => void
  fetching: boolean
  fetchErr: string | null
}) {
  const bd = useMemo(() => calcScore(inputs), [inputs])

  const iStyle: React.CSSProperties = {
    padding: '5px 9px', background: 'rgba(255,255,255,0.03)',
    border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 7,
    color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none',
  }

  const pts = (n: number) => (
    <span style={{ fontSize: 11, fontWeight: 700, minWidth: 46, textAlign: 'right', flexShrink: 0,
      color: n > 0 ? '#6f9be5' : 'rgba(255,255,255,0.2)' }}>
      {n > 0 ? `+${n}` : '0'} pts
    </span>
  )

  const row = (label: string, hint: string, earnedPts: number, control: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
      borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2, lineHeight: 1.5 }}>{hint}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
      {pts(earnedPts)}
    </div>
  )

  const numRow = (k: keyof ScoreInputs, earnedPts: number, label: string, hint: string, w = 100) =>
    row(label, hint, earnedPts,
      <input type="number" min={0} value={inputs[k] as number}
        onChange={e => onChange(k, +e.target.value)}
        style={{ ...iStyle, width: w }} />
    )

  const checkRow = (k: keyof ScoreInputs, earnedPts: number, label: string, hint: string) =>
    row(label, hint, inputs[k] ? earnedPts : 0,
      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
        <input type="checkbox" checked={inputs[k] as boolean}
          onChange={e => onChange(k, e.target.checked)}
          style={{ accentColor: '#6f9be5', width: 14, height: 14 }} />
        Yes
      </label>
    )

  const catHeader = (label: string, catPts: number, max: number) => (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: 22, marginBottom: 2,
      paddingBottom: 7, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)',
        textTransform: 'uppercase', letterSpacing: '1.2px', flex: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700,
        color: catPts >= max ? 'var(--green)' : catPts > 0 ? '#6f9be5' : 'rgba(255,255,255,0.2)' }}>
        {catPts} / {max} pts
      </div>
    </div>
  )

  const twPts   = inputs.twitter_followers >= 20000 ? 15 : inputs.twitter_followers >= 5000 ? 10 : inputs.twitter_followers >= 1000 ? 5 : 0
  const dcPts   = inputs.discord_members >= 1000 ? 5 : inputs.discord_members >= 100 ? 3 : 0
  const ghPts   = inputs.github_commits_30d >= 50 ? 5 : inputs.github_commits_30d >= 11 ? 4 : inputs.github_commits_30d >= 1 ? 2 : 0
  const stagePts = inputs.product_stage === 'mainnet' ? 15 : inputs.product_stage === 'testnet' ? 7 : 0
  const wPts    = inputs.onchain_wallets >= 10000 ? 15 : inputs.onchain_wallets >= 1000 ? 10 : inputs.onchain_wallets >= 100 ? 4 : 0
  const tvlPts  = inputs.onchain_tvl >= 1000000 ? 5 : inputs.onchain_tvl >= 100000 ? 3 : 0
  const agePts  = inputs.contract_age_months >= 12 ? 10 : inputs.contract_age_months >= 6 ? 5 : 0

  const CATS = [
    { l: 'Social',   v: bd.social,   m: 25 },
    { l: 'Product',  v: bd.product,  m: 25 },
    { l: 'On-chain', v: bd.onchain,  m: 20 },
    { l: 'Team',     v: bd.team,     m: 15 },
    { l: 'Track',    v: bd.track,    m: 15 },
    { l: 'Bonus',    v: bd.bonus,    m: 10 },
  ]

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>

      {/* ── Total score card ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 18px',
        background: 'rgba(255,255,255,0.02)', borderRadius: 12,
        border: '0.5px solid rgba(255,255,255,0.07)', marginBottom: 6 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: scoreColor(bd.total), lineHeight: 1 }}>{bd.total}</div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 3 }}>/ 110 pts</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3,
            marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, transition: 'width 0.25s',
              width: `${Math.min((bd.total / 110) * 100, 100)}%`,
              background: scoreColor(bd.total) }} />
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {CATS.map(c => (
              <div key={c.l} style={{ fontSize: 10, color: 'var(--muted2)' }}>
                {c.l}:{' '}
                <b style={{ color: c.v > 0 ? 'var(--text)' : 'rgba(255,255,255,0.2)' }}>{c.v}</b>
                /{c.m}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted2)' }}>
            {bd.total < 26 ? '⚪ Not verified' : bd.total < 51 ? '🔵 Basic listing' : bd.total < 76 ? '✅ Verified' : bd.total < 91 ? '✅✅ Trusted' : '✅✅✅ Elite'}
          </div>
        </div>
      </div>

      {/* ── SOCIAL ── */}
      {catHeader('Social Presence', bd.social, 25)}
      {numRow('twitter_followers', twPts,
        'Twitter / X followers',
        '<1 000 = 0 pts  ·  1k–5k = +5  ·  5k–20k = +10  ·  20k+ = +15')}
      {numRow('discord_members', dcPts,
        'Discord / Telegram members',
        '<100 = 0 pts  ·  100–999 = +3  ·  1 000+ = +5')}
      {row(
        'GitHub commits (last 30 days)',
        '0 = 0 pts  ·  1–10 = +2  ·  11–50 = +4  ·  50+ = +5',
        ghPts,
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={githubUrl} onChange={e => onGithubUrlChange(e.target.value)}
            placeholder="github.com/org/repo"
            style={{ ...iStyle, width: 190, fontFamily: 'monospace', fontSize: 11 }} />
          <button onClick={onGithubFetch} disabled={fetching || !githubUrl}
            title={githubUrl ? 'Fetch from GitHub API' : 'Enter GitHub URL first'}
            style={{ padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit', fontSize: 11, cursor: githubUrl ? 'pointer' : 'not-allowed',
              border: '0.5px solid rgba(111,155,229,0.35)', background: 'rgba(111,155,229,0.08)',
              color: '#6f9be5', opacity: githubUrl ? 1 : 0.4, flexShrink: 0 }}>
            <i className={`ph-bold ${fetching ? 'ph-circle-notch' : 'ph-arrows-clockwise'}`}
              style={{ fontSize: 11, marginRight: 3 }} />
            {inputs.github_commits_30d > 0 ? inputs.github_commits_30d : 'Fetch'}
          </button>
        </div>
      )}
      {fetchErr && (
        <div style={{ fontSize: 10, color: 'var(--red)', padding: '4px 0' }}>
          <i className="ph-bold ph-warning-circle" style={{ marginRight: 4 }} />{fetchErr}
        </div>
      )}

      {/* ── PRODUCT ── */}
      {catHeader('Product', bd.product, 25)}
      {row(
        'Product stage',
        'None / Idea = 0 pts  ·  Testnet / Beta = +7  ·  Mainnet live = +15',
        stagePts,
        <select value={inputs.product_stage} onChange={e => onChange('product_stage', e.target.value)}
          style={{ ...iStyle, width: 145, cursor: 'pointer' }}>
          <option value="none">None / Idea</option>
          <option value="testnet">Testnet / Beta</option>
          <option value="mainnet">Mainnet live</option>
        </select>
      )}
      {checkRow('has_whitepaper', 3,
        'Whitepaper / documentation',
        'Published detailed technical or product docs  →  +3 pts')}
      {checkRow('has_audit', 12,
        'Smart contract audit',
        'Audited by CertiK, Hacken, Trail of Bits, or equivalent  →  +12 pts')}

      {/* ── ON-CHAIN ── */}
      {catHeader('On-chain Activity', bd.onchain, 20)}
      {row(
        'Contract address (Base Mainnet)',
        'Used to auto-fetch data via BaseScan API (add BASESCAN_API_KEY to .env)',
        0,
        <input value={contractAddress} onChange={e => onContractChange(e.target.value)}
          placeholder="0x…"
          style={{ ...iStyle, width: 210, fontFamily: 'monospace', fontSize: 11 }} />
      )}
      {numRow('onchain_wallets', wPts,
        'Unique wallet addresses',
        '<100 = 0 pts  ·  100–999 = +4  ·  1k–9 999 = +10  ·  10k+ = +15')}
      {numRow('onchain_tvl', tvlPts,
        'TVL (USD)',
        '<$100k = 0 pts  ·  $100k–$1M = +3  ·  $1M+ = +5')}

      {/* ── TEAM ── */}
      {catHeader('Team', bd.team, 15)}
      {checkRow('team_doxxed', 8,
        'Team is doxxed',
        'Real names + LinkedIn or verifiable public identity  →  +8 pts')}
      {checkRow('has_investors', 7,
        'Investors / backers public',
        'Known investors or VCs are publicly named  →  +7 pts')}

      {/* ── TRACK RECORD ── */}
      {catHeader('Track Record', bd.track, 15)}
      {numRow('contract_age_months', agePts,
        'Contract / project age (months)',
        '<6 months = 0  ·  6–11 months = +5  ·  12+ months = +10')}
      {checkRow('has_partnerships', 5,
        'Active partnerships',
        'Integration or partnership with an established protocol  →  +5 pts')}

      {/* ── BONUS ── */}
      {catHeader('Bonus (capped at +10)', bd.bonus, 10)}
      {checkRow('has_cex_listing', 4,
        'Listed on CEX',
        'Token listed on any centralized exchange  →  +4 pts')}
      {checkRow('has_foundation_grant', 3,
        'Foundation grant received',
        'Grant from Base, Optimism, Arbitrum, or equivalent  →  +3 pts')}
      {checkRow('has_media_mentions', 3,
        'Major media mention',
        'Coindesk, The Block, Bankless, or equivalent  →  +3 pts')}
      {checkRow('has_hackathon_win', 2,
        'Hackathon prize / winner',
        'Placed in any recognized hackathon  →  +2 pts')}
      {checkRow('has_top_integration', 3,
        'Top-protocol integration',
        'Integrated with Uniswap, Aave, Chainlink, or similar  →  +3 pts')}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', slug: '', category: '', description: '',
  admin_wallet: '', website_url: '', trust_score: 0, is_verified: false,
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { address, isConnected } = useAppKitAccount()
  const { open } = useAppKit()

  const [projects,   setProjects]   = useState<Project[]>([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [saveErr,    setSaveErr]    = useState<string | null>(null)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [delConfirm, setDelConfirm] = useState<string | null>(null)
  const [delInput,   setDelInput]   = useState('')

  // score builder state
  const [scoreInputs,    setScoreInputs]    = useState<ScoreInputs>(SCORE_DEFAULTS)
  const [editContract,   setEditContract]   = useState('')
  const [editGithubUrl,  setEditGithubUrl]  = useState('')
  const [editWallet,     setEditWallet]     = useState('')
  const [editVerif,      setEditVerif]      = useState(false)
  const [fetchingGh,     setFetchingGh]     = useState(false)
  const [fetchErr,       setFetchErr]       = useState<string | null>(null)
  const [uploadingAv,    setUploadingAv]    = useState(false)
  const [uploadAvMsg,    setUploadAvMsg]    = useState<string | null>(null)
  const adminAvRef = useRef<HTMLInputElement>(null)

  const isAdmin = !!address && address.toLowerCase() === SUPER_ADMIN

  const load = useCallback(async () => {
    if (!address || !isAdmin) return
    setLoading(true)
    try {
      const r = await fetch(`/api/admin?wallet=${address}`)
      const d = await r.json() as { projects?: Project[]; error?: string }
      if (d.projects) setProjects(d.projects)
    } finally { setLoading(false) }
  }, [address, isAdmin])

  useEffect(() => { load() }, [load])

  function openEdit(p: Project) {
    setEditId(p.id)
    setEditWallet(p.admin_wallet ?? '')
    setEditVerif(p.is_verified)
    setEditContract(p.contract_address ?? '')
    setEditGithubUrl(p.github_url ?? '')
    setFetchErr(null)
    setScoreInputs({
      twitter_followers:   p.twitter_followers   ?? 0,
      discord_members:     p.discord_members     ?? 0,
      github_commits_30d:  p.github_commits_30d  ?? 0,
      product_stage:       (p.product_stage as ScoreInputs['product_stage']) ?? 'none',
      has_whitepaper:      p.has_whitepaper      ?? false,
      has_audit:           p.has_audit           ?? false,
      onchain_wallets:     p.onchain_wallets     ?? 0,
      onchain_tvl:         p.onchain_tvl         ?? 0,
      team_doxxed:         p.team_doxxed         ?? false,
      has_investors:       p.has_investors        ?? false,
      contract_age_months: p.contract_age_months ?? 0,
      has_partnerships:    p.has_partnerships    ?? false,
      has_cex_listing:     p.has_cex_listing     ?? false,
      has_foundation_grant: p.has_foundation_grant ?? false,
      has_media_mentions:  p.has_media_mentions  ?? false,
      has_hackathon_win:   p.has_hackathon_win   ?? false,
      has_top_integration: p.has_top_integration ?? false,
    })
  }

  async function fetchGithub() {
    if (!address || !editGithubUrl) return
    setFetchingGh(true); setFetchErr(null)
    try {
      const r = await fetch(`/api/admin/score?wallet=${address}&github=${encodeURIComponent(editGithubUrl)}`)
      const d = await r.json() as { github_commits_30d?: number; github_error?: string }
      if (d.github_error) throw new Error(d.github_error)
      if (typeof d.github_commits_30d === 'number') {
        setScoreInputs(s => ({ ...s, github_commits_30d: d.github_commits_30d! }))
      }
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : 'Fetch failed')
    } finally { setFetchingGh(false) }
  }

  async function uploadAdminAvatar(file: File, slug: string) {
    if (!address) return
    setUploadingAv(true); setUploadAvMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('wallet', address)
      fd.append('slug', slug)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setProjects(ps => ps.map(x => x.slug === slug ? { ...x, avatar_url: data.url! } : x))
      setUploadAvMsg('Updated!')
      setTimeout(() => setUploadAvMsg(null), 3000)
    } catch (e) {
      setUploadAvMsg(e instanceof Error ? e.message : 'Upload failed')
    } finally { setUploadingAv(false) }
  }

  async function saveEdit(id: string) {
    if (!address) return
    const score = calcScore(scoreInputs)
    const r = await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: address, id,
        admin_wallet:     editWallet || null,
        is_verified:      editVerif,
        contract_address: editContract || null,
        github_url:       editGithubUrl || null,
        trust_score:      score.total,
        ...scoreInputs,
      }),
    })
    if (r.ok) {
      const d = await r.json() as { project?: Project }
      if (d.project) setProjects(p => p.map(x => x.id === id ? d.project! : x))
      setEditId(null)
    }
  }

  async function createProject() {
    if (!address || !form.name.trim() || !form.slug.trim()) return
    setSaving(true); setSaveErr(null)
    try {
      const r = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, ...form, trust_score: Number(form.trust_score) }),
      })
      const d = await r.json() as { project?: Project; error?: string }
      if (!r.ok) throw new Error(d.error ?? 'Failed')
      setProjects(p => [d.project!, ...p])
      setForm(EMPTY_FORM); setShowForm(false)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Error')
    } finally { setSaving(false) }
  }

  async function deleteProject(id: string) {
    if (!address) return
    const r = await fetch(`/api/admin?id=${id}&wallet=${address}`, { method: 'DELETE' })
    if (r.ok) { setProjects(p => p.filter(x => x.id !== id)); setDelConfirm(null); setDelInput('') }
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  // ── Not connected ──
  if (!isConnected || !address) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16, background: 'var(--bg)' }}>
        <i className="ph-bold ph-shield-slash" style={{ fontSize: 40, color: 'var(--muted2)' }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Admin access</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 260, textAlign: 'center', lineHeight: 1.6 }}>
          Connect your admin wallet to access this page.
        </div>
        <button onClick={() => open()}
          style={{ padding: '9px 20px', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit' }}>
          Connect Wallet
        </button>
      </div>
    )
  }

  // ── Wrong wallet ──
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 12, background: 'var(--bg)' }}>
        <i className="ph-bold ph-lock" style={{ fontSize: 40, color: 'var(--red)', opacity: 0.6 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Access denied</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
          {address.slice(0, 6)}…{address.slice(-4)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>This wallet is not authorised.</div>
      </div>
    )
  }

  // ── Main ──
  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)', padding: '18px 28px',
        display: 'flex', alignItems: 'center', gap: 14 }}>
        <a href="/" style={{ color: 'var(--muted2)', fontSize: 12, display: 'flex',
          alignItems: 'center', gap: 5, textDecoration: 'none' }}>
          <i className="ph-bold ph-arrow-left" style={{ fontSize: 11 }} /> App
        </a>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          <i className="ph-bold ph-shield-star" style={{ marginRight: 8, color: '#6f9be5' }} />
          Zexus Admin
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'monospace' }}>
          {address.slice(0, 6)}…{address.slice(-4)}
        </div>
        <div style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6,
          background: 'rgba(111,155,229,0.12)', color: '#6f9be5',
          border: '0.5px solid rgba(111,155,229,0.25)', fontWeight: 600 }}>
          Super Admin
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total projects', value: projects.length, icon: 'ph-buildings' },
            { label: 'Verified', value: projects.filter(p => p.is_verified).length, icon: 'ph-shield-check', color: 'var(--green)' },
            { label: 'Avg Trust Score', icon: 'ph-chart-line', color: '#6f9be5',
              value: projects.length ? Math.round(projects.reduce((s, p) => s + p.trust_score, 0) / projects.length) : '—' },
          ].map(s => (
            <div key={s.label} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase',
                letterSpacing: '1.2px', marginBottom: 8 }}>
                <i className={`ph-bold ${s.icon}`} style={{ marginRight: 5 }} />{s.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: (s as { color?: string }).color ?? 'var(--text)' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <i className="ph-bold ph-magnifying-glass"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--muted2)', fontSize: 12 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', background: 'rgba(255,255,255,0.03)',
                border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 9, color: 'var(--text)',
                fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button onClick={() => { setShowForm(v => !v); setSaveErr(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
              border: '0.5px solid rgba(111,155,229,0.35)', fontFamily: 'inherit',
              background: showForm ? 'rgba(111,155,229,0.15)' : 'rgba(111,155,229,0.08)',
              color: '#6f9be5', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            <i className={`ph-bold ${showForm ? 'ph-x' : 'ph-plus'}`} />
            {showForm ? 'Cancel' : 'Add Project'}
          </button>
          <button onClick={load} title="Refresh"
            style={{ padding: '8px 12px', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.08)',
              background: 'transparent', color: 'var(--muted2)', cursor: 'pointer', fontSize: 14 }}>
            <i className={`ph-bold ph-arrow-clockwise${loading ? ' spin' : ''}`} />
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div style={{ background: 'transparent', border: '0.5px solid rgba(111,155,229,0.2)',
            borderRadius: 14, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6f9be5', marginBottom: 16,
              letterSpacing: '1px', textTransform: 'uppercase' }}>
              <i className="ph-bold ph-plus-circle" style={{ marginRight: 6 }} />New Project
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([
                { label: 'PROJECT NAME *', key: 'name',         ph: 'AeroBase' },
                { label: 'SLUG *',         key: 'slug',         ph: 'aerobase' },
                { label: 'CATEGORY',       key: 'category',     ph: 'AMM, DEX, Lending…' },
                { label: 'ADMIN WALLET',   key: 'admin_wallet', ph: '0x…' },
                { label: 'WEBSITE',        key: 'website_url',  ph: 'https://…' },
              ] as Array<{ label: string; key: keyof typeof form; ph: string; type?: string }>).map(({ label, key, ph, type }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px' }}>{label}</label>
                  <input type={type ?? 'text'} value={String(form[key])} placeholder={ph}
                    onChange={e => {
                      const val = type === 'number' ? Number(e.target.value) : e.target.value
                      setForm(f => ({
                        ...f, [key]: val,
                        ...(key === 'name' && f.slug === slugify(f.name) ? { slug: slugify(e.target.value) } : {}),
                      }))
                    }}
                    style={{ padding: '8px 11px', background: 'rgba(255,255,255,0.03)',
                      border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 8,
                      color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px' }}>DESCRIPTION</label>
              <textarea value={form.description} rows={2}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short project description…"
                style={{ padding: '8px 11px', background: 'rgba(255,255,255,0.03)',
                  border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 8,
                  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>
                <input type="checkbox" checked={form.is_verified}
                  onChange={e => setForm(f => ({ ...f, is_verified: e.target.checked }))} />
                Verified project
              </label>
            </div>
            {saveErr && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)' }}>
                <i className="ph-bold ph-warning-circle" style={{ marginRight: 5 }} />{saveErr}
              </div>
            )}
            <button onClick={createProject} disabled={saving || !form.name.trim() || !form.slug.trim()}
              style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 9,
                border: '0.5px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.07)',
                color: 'var(--text)', fontSize: 13, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating…' : <><i className="ph-bold ph-plus" style={{ marginRight: 6 }} />Create Project</>}
            </button>
          </div>
        )}

        {/* Projects list */}
        {loading && !projects.length ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(p => (
              <div key={p.id} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '14px 16px' }}>

                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover' }} />
                      : p.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <a href={`/projects/${p.slug}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#6f9be5')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}>
                        {p.name}
                      </a>
                      <span style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: 'monospace' }}>{p.slug}</span>
                      {p.is_verified && (
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5,
                          background: 'rgba(83,201,146,0.1)', color: 'var(--green)',
                          border: '0.5px solid rgba(83,201,146,0.25)', fontWeight: 700 }}>VERIFIED</span>
                      )}
                      {p.category && (
                        <span style={{ fontSize: 10, color: 'var(--muted)', padding: '1px 6px',
                          borderRadius: 5, border: '0.5px solid rgba(255,255,255,0.06)' }}>{p.category}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                      {p.admin_wallet
                        ? <><i className="ph-bold ph-wallet" style={{ marginRight: 4 }} />
                          {p.admin_wallet.slice(0, 10)}…{p.admin_wallet.slice(-6)}</>
                        : <span style={{ opacity: 0.4 }}>No admin wallet</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(p.trust_score), flexShrink: 0 }}>
                    {p.trust_score}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => editId === p.id ? setEditId(null) : openEdit(p)}
                      title={editId === p.id ? 'Close' : 'Edit + Score'}
                      style={{ padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12,
                        border: editId === p.id ? '0.5px solid rgba(111,155,229,0.35)' : '0.5px solid rgba(255,255,255,0.09)',
                        background: editId === p.id ? 'rgba(111,155,229,0.1)' : 'transparent',
                        color: editId === p.id ? '#6f9be5' : 'var(--muted2)' }}>
                      <i className={`ph-bold ${editId === p.id ? 'ph-x' : 'ph-pencil-simple'}`} />
                    </button>
                    <button onClick={() => { setDelConfirm(p.id); setDelInput('') }} title="Delete"
                      style={{ padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12,
                        border: '0.5px solid rgba(238,121,121,0.2)', background: 'transparent',
                        color: 'var(--red)', opacity: 0.7 }}>
                      <i className="ph-bold ph-trash" />
                    </button>
                  </div>
                </div>

                {/* ── Score builder panel ── */}
                {editId === p.id && (
                  <div style={{ marginTop: 4 }}>
                    {/* Basic fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14,
                      paddingTop: 14, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                      {[
                        { label: 'ADMIN WALLET', val: editWallet, set: setEditWallet, ph: '0x…', mono: true },
                      ].map(f => (
                        <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px' }}>{f.label}</label>
                          <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                            style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.03)',
                              border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 7,
                              color: 'var(--text)', fontSize: f.mono ? 11 : 12,
                              fontFamily: f.mono ? 'monospace' : 'inherit', outline: 'none' }} />
                        </div>
                      ))}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'flex-end' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12,
                          color: 'var(--muted)', cursor: 'pointer', paddingBottom: 8 }}>
                          <input type="checkbox" checked={editVerif} onChange={e => setEditVerif(e.target.checked)}
                            style={{ accentColor: '#6f9be5' }} />
                          Verified project
                        </label>
                      </div>
                    </div>
                    {/* Avatar upload */}
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>AVATAR</label>
                      <input
                        ref={adminAvRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadAdminAvatar(f, p.slug) }}
                      />
                      {p.avatar_url && (
                        <img src={p.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <button
                        type="button"
                        onClick={() => adminAvRef.current?.click()}
                        disabled={uploadingAv}
                        style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                          border: '0.5px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', opacity: uploadingAv ? 0.6 : 1 }}>
                        {uploadingAv ? 'Uploading…' : 'Change avatar'}
                      </button>
                      {uploadAvMsg && <span style={{ fontSize: 11, color: uploadAvMsg.includes('fail') ? 'var(--red)' : 'var(--green)' }}>{uploadAvMsg}</span>}
                    </div>

                    {/* Score builder */}
                    <ScoreBuilder
                      inputs={scoreInputs}
                      onChange={(k, v) => setScoreInputs(s => ({ ...s, [k]: v }))}
                      contractAddress={editContract}
                      onContractChange={setEditContract}
                      githubUrl={editGithubUrl}
                      onGithubUrlChange={setEditGithubUrl}
                      onGithubFetch={fetchGithub}
                      fetching={fetchingGh}
                      fetchErr={fetchErr}
                    />

                    {/* Save / cancel */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                      <button onClick={() => saveEdit(p.id)}
                        style={{ flex: 1, padding: '10px', borderRadius: 9,
                          border: '0.5px solid rgba(111,155,229,0.4)',
                          background: 'rgba(111,155,229,0.12)', color: '#6f9be5',
                          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <i className="ph-bold ph-floppy-disk" style={{ marginRight: 6 }} />
                        Save & recalculate score
                      </button>
                      <button onClick={() => setEditId(null)}
                        style={{ padding: '10px 18px', borderRadius: 9,
                          border: '0.5px solid rgba(255,255,255,0.07)', background: 'transparent',
                          color: 'var(--muted2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete confirm — two-step */}
                {delConfirm === p.id && (
                  <div style={{ marginTop: 10, paddingTop: 14,
                    borderTop: '0.5px solid rgba(238,121,121,0.2)',
                    background: 'rgba(238,121,121,0.04)', borderRadius: 8,
                    padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="ph-bold ph-warning" style={{ color: 'var(--red)', fontSize: 15, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>
                          Удаление необратимо
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          Введи название проекта <b style={{ color: 'var(--text)' }}>{p.name}</b> для подтверждения
                        </div>
                      </div>
                    </div>
                    <input
                      value={delInput}
                      onChange={e => setDelInput(e.target.value)}
                      placeholder={`Введи "${p.name}"`}
                      autoFocus
                      style={{ padding: '8px 11px', background: 'rgba(255,255,255,0.03)',
                        border: `0.5px solid ${delInput === p.name ? 'rgba(238,121,121,0.6)' : 'rgba(255,255,255,0.09)'}`,
                        borderRadius: 8, color: 'var(--text)', fontSize: 13,
                        fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => deleteProject(p.id)}
                        disabled={delInput !== p.name}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, fontFamily: 'inherit',
                          border: '0.5px solid rgba(238,121,121,0.5)',
                          background: delInput === p.name ? 'rgba(238,121,121,0.15)' : 'rgba(255,255,255,0.02)',
                          color: delInput === p.name ? 'var(--red)' : 'rgba(255,255,255,0.2)',
                          fontSize: 12, fontWeight: 700,
                          cursor: delInput === p.name ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s' }}>
                        <i className="ph-bold ph-trash" style={{ marginRight: 6 }} />
                        Удалить {p.name}
                      </button>
                      <button onClick={() => { setDelConfirm(null); setDelInput('') }}
                        style={{ padding: '8px 16px', borderRadius: 8, fontFamily: 'inherit',
                          border: '0.5px solid rgba(255,255,255,0.07)', background: 'transparent',
                          color: 'var(--muted2)', fontSize: 12, cursor: 'pointer' }}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ))}
            {filtered.length === 0 && !loading && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 13 }}>
                {search ? 'No projects match your search' : 'No projects yet'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
