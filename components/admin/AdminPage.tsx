'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'


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
  contact_email:        string | null
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
  admin_wallet: '', website_url: '', contact_email: '', trust_score: 0, is_verified: false,
}

// ── Analytics types ───────────────────────────────────────────────────────────

interface Analytics {
  platform: {
    total_users: number; total_projects: number; total_posts: number
    total_likes: number; total_comments: number; total_watchlist_entries: number
    total_checkins: number; new_users_today: number; active_users_7d: number
    telegram_connected: number
  }
  zxp: {
    total_circulating: number; total_staked: number; earned_today: number
    predict_locked: number; predict_markets: number
  }
  top_holders: { rank: number; wallet: string; balance: number; streak: number }[]
  top_stakers: { rank: number; wallet: string; staked: number }[]
  posts_7d:     { date: string; count: number }[]
  checkins_7d:  { date: string; count: number }[]
  posts_30d:    { date: string; count: number }[]
  checkins_30d: { date: string; count: number }[]
  onboarding:   Record<string, number>
  zxp_supply:   { date: string; circulating: number; staked: number }[]
}

// ── Mini spark bar ─────────────────────────────────────────────────────────────

// 'YYYY-MM-DD' → 'Jun 6'
function fmtDay(iso: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [, m, d] = iso.split('-').map(Number)
  return `${months[(m ?? 1) - 1]} ${d}`
}

function SparkBars({ data, color, unit }: { data: { date: string; count: number }[]; color: string; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ position: 'relative' }}>
      {hover !== null && data[hover] && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)',
          left: `${((hover + 0.5) / data.length) * 100}%`, transform: 'translateX(-50%)',
          background: 'rgba(18,18,22,0.97)', border: '0.5px solid rgba(255,255,255,0.12)',
          borderRadius: 7, padding: '5px 9px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
          boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {data[hover].count} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted2)' }}>{unit}</span>
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--muted2)', marginTop: 1 }}>{fmtDay(data[hover].date)}</div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
        {data.map((d, i) => (
          <div key={d.date}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'default' }}>
            <div style={{
              width: '100%', background: color,
              height: `${Math.max(4, (d.count / max) * 100)}%`,
              borderRadius: '2px 2px 0 0',
              opacity: hover === i ? 1 : d.count === 0 ? 0.2 : 0.85,
              transition: 'opacity 0.15s, height 0.3s',
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Supply line chart ──────────────────────────────────────────────────────────

function SparkLine({ data }: { data: { date: string; circulating: number; staked: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 480, H = 72, PAD = 4
  if (data.length < 2) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, color: 'var(--muted2)' }}>
        Not enough data yet — check back tomorrow
      </div>
    )
  }
  // Normalize across BOTH series so the staked line always stays inside the chart
  const allVals = data.flatMap(d => [d.circulating, d.staked])
  const maxVal  = Math.max(...allVals, 1)
  const minVal  = Math.min(...allVals)
  const range   = maxVal - minVal || 1

  const toX = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2)
  const toY = (v: number) => H - PAD - ((v - minVal) / range) * (H - PAD * 2)

  const circ  = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.circulating).toFixed(1)}`).join(' ')
  const staked = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.staked).toFixed(1)}`).join(' ')

  // Area fill under circulating line
  const areaPath = [
    `M ${toX(0).toFixed(1)},${H - PAD}`,
    ...data.map((d, i) => `L ${toX(i).toFixed(1)},${toY(d.circulating).toFixed(1)}`),
    `L ${toX(data.length - 1).toFixed(1)},${H - PAD}`,
    'Z',
  ].join(' ')

  const h = hover !== null ? data[hover] : null

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      {h && (
        <div style={{
          position: 'absolute', top: 0, transform: 'translate(-50%, -100%)',
          left: `${(toX(hover!) / W) * 100}%`, marginTop: -6,
          background: 'rgba(18,18,22,0.97)', border: '0.5px solid rgba(255,255,255,0.12)',
          borderRadius: 7, padding: '6px 10px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
          boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        }}>
          <div style={{ fontSize: 9.5, color: 'var(--muted2)', marginBottom: 3 }}>{fmtDay(h.date)}</div>
          <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
            <span style={{ color: 'var(--gold)' }}>Circulating</span>
            <b style={{ color: 'var(--text)' }}>{h.circulating.toLocaleString()}</b>
          </div>
          <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 2 }}>
            <span style={{ color: '#f59e0b' }}>Staked</span>
            <b style={{ color: 'var(--text)' }}>{h.staked.toLocaleString()}</b>
          </div>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, overflow: 'visible' }}>
        <defs>
          <linearGradient id="circGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(201,165,90,0.25)" />
            <stop offset="100%" stopColor="rgba(201,165,90,0)" />
          </linearGradient>
        </defs>
        {/* grid lines */}
        {[0, 0.5, 1].map(t => (
          <line key={t}
            x1={PAD} y1={(H - PAD - t * (H - PAD * 2)).toFixed(1)}
            x2={W - PAD} y2={(H - PAD - t * (H - PAD * 2)).toFixed(1)}
            stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"
          />
        ))}
        {/* area fill */}
        <path d={areaPath} fill="url(#circGrad)" />
        {/* staked line */}
        <polyline points={staked} fill="none" stroke="rgba(245,158,11,0.35)" strokeWidth="1.2" strokeDasharray="3 3" />
        {/* circulating line */}
        <polyline points={circ} fill="none" stroke="rgba(201,165,90,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* hover guide line + markers */}
        {hover !== null && h && (
          <>
            <line x1={toX(hover)} y1={PAD} x2={toX(hover)} y2={H - PAD} stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
            <circle cx={toX(hover)} cy={toY(h.staked)} r="2.5" fill="#f59e0b" />
            <circle cx={toX(hover)} cy={toY(h.circulating)} r="3" fill="var(--gold)" />
          </>
        )}
        {/* last point dot (hidden while hovering) */}
        {hover === null && (
          <circle
            cx={toX(data.length - 1).toFixed(1)}
            cy={toY(data[data.length - 1].circulating).toFixed(1)}
            r="3" fill="var(--gold)"
          />
        )}
        {/* invisible hover bands — scale with the viewBox so mapping stays exact */}
        {data.map((d, i) => {
          const x0 = i === 0 ? 0 : (toX(i - 1) + toX(i)) / 2
          const x1 = i === data.length - 1 ? W : (toX(i) + toX(i + 1)) / 2
          return (
            <rect key={d.date} x={x0} y={0} width={x1 - x0} height={H}
              fill="transparent" style={{ pointerEvents: 'all' }}
              onMouseEnter={() => setHover(i)} />
          )
        })}
      </svg>
    </div>
  )
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { address, isConnected } = useAppKitAccount()
  const { open } = useAppKit()

  const [isAdmin,    setIsAdmin]    = useState(false)
  const [adminTab,   setAdminTab]   = useState<'projects' | 'analytics' | 'posts' | 'predict' | 'invites'>('projects')

  interface InviteCode {
    code: string; project_name: string | null; note: string | null
    created_at: string; used_at: string | null; expires_at: string | null
  }
  const [invites,     setInvites]     = useState<InviteCode[]>([])
  const [invLoading,  setInvLoading]  = useState(false)
  const [invForm,     setInvForm]     = useState({ code: '', project_name: '', note: '', expires_at: '' })
  const [invSaving,   setInvSaving]   = useState(false)
  const [invErr,      setInvErr]      = useState<string | null>(null)
  const [invShowForm, setInvShowForm] = useState(false)
  const [invDelCode,  setInvDelCode]  = useState<string | null>(null)
  const [analytics,  setAnalytics]  = useState<Analytics | null>(null)
  const [anLoading,  setAnLoading]  = useState(false)
  const [anRange,    setAnRange]    = useState<'7d' | '30d'>('7d')

  // Predict market state
  interface PredictMarket {
    id: string; title: string; description: string | null; category: string
    project_name: string | null; option_a: string; option_b: string
    pool_a: number; pool_b: number; status: string; outcome: string | null
    closes_at: string; resolved_at: string | null; participants?: number
  }
  const [predMarkets,    setPredMarkets]    = useState<PredictMarket[]>([])
  const [predLoading,    setPredLoading]    = useState(false)
  const [predForm,       setPredForm]       = useState({
    title: '', description: '', category: 'Platform', option_a: 'Yes', option_b: 'No',
    closes_at: '', project_name: '',
  })
  const [predSaving,     setPredSaving]     = useState(false)
  const [predErr,        setPredErr]        = useState<string | null>(null)
  const [predShowForm,   setPredShowForm]   = useState(false)
  const [resolvingId,    setResolvingId]    = useState<string | null>(null)
  const [resolveOutcome, setResolveOutcome] = useState<'a' | 'b' | null>(null)
  const [resolveBusy,    setResolveBusy]    = useState(false)
  const [resolveMsg,     setResolveMsg]     = useState<string | null>(null)

  // Posts moderation state
  interface AdminPost {
    id: string; project_name: string; project_slug: string | null
    post_type: string; title: string | null; content: string
    created_at: string; like_count: number; comment_count: number; view_count: number
    avatar_url: string | null; letter: string; av: string
  }
  const [modPosts,     setModPosts]     = useState<AdminPost[]>([])
  const [modLoading,   setModLoading]   = useState(false)
  const [modSearch,    setModSearch]    = useState('')
  const [modDelId,     setModDelId]     = useState<string | null>(null)
  const [modDeleting,  setModDeleting]  = useState(false)

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
  const [editEmail,      setEditEmail]      = useState('')
  const [editVerif,      setEditVerif]      = useState(false)
  const [fetchingGh,     setFetchingGh]     = useState(false)
  const [fetchErr,       setFetchErr]       = useState<string | null>(null)
  const [uploadingAv,    setUploadingAv]    = useState(false)
  const [uploadAvMsg,    setUploadAvMsg]    = useState<string | null>(null)
  const adminAvRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!address) { setIsAdmin(false); return }
    fetch(`/api/admin/check?wallet=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then((d: { isAdmin?: boolean }) => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [address])

  const load = useCallback(async () => {
    if (!address || !isAdmin) return
    setLoading(true)
    try {
      const r = await fetch(`/api/admin?wallet=${address}`)
      const d = await r.json() as { projects?: Project[]; error?: string }
      if (d.projects) setProjects(d.projects)
    } finally { setLoading(false) }
  }, [address, isAdmin])

  const loadAnalytics = useCallback(async () => {
    if (!address || !isAdmin) return
    setAnLoading(true)
    try {
      const r = await fetch(`/api/admin/analytics?wallet=${address}`)
      const d = await r.json() as Analytics
      setAnalytics(d)
    } finally { setAnLoading(false) }
  }, [address, isAdmin])

  const loadPosts = useCallback(async () => {
    if (!address || !isAdmin) return
    setModLoading(true)
    try {
      const r = await fetch('/api/posts?limit=50')
      const d = await r.json() as { posts?: AdminPost[] }
      setModPosts(d.posts ?? [])
    } finally { setModLoading(false) }
  }, [address, isAdmin])

  async function deletePost(id: string) {
    if (!address || modDeleting) return
    setModDeleting(true)
    try {
      const r = await fetch(`/api/posts?id=${id}&wallet=${address}`, { method: 'DELETE' })
      if (r.ok) { setModPosts(ps => ps.filter(p => p.id !== id)); setModDelId(null) }
    } finally { setModDeleting(false) }
  }

  const loadInvites = useCallback(async () => {
    if (!address || !isAdmin) return
    setInvLoading(true)
    try {
      const r = await fetch(`/api/admin/invites?wallet=${address}`)
      const d = await r.json() as { codes?: InviteCode[] }
      setInvites(d.codes ?? [])
    } finally { setInvLoading(false) }
  }, [address, isAdmin])

  const loadPredict = useCallback(async () => {
    if (!address || !isAdmin) return
    setPredLoading(true)
    try {
      const d = await fetch('/api/predict').then(r => r.json()) as { markets?: PredictMarket[] }
      setPredMarkets(d.markets ?? [])
    } finally { setPredLoading(false) }
  }, [address, isAdmin])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (adminTab === 'analytics') loadAnalytics() }, [adminTab, loadAnalytics])
  useEffect(() => { if (adminTab === 'posts')     loadPosts()     }, [adminTab, loadPosts])
  useEffect(() => { if (adminTab === 'predict')   loadPredict()   }, [adminTab, loadPredict])
  useEffect(() => { if (adminTab === 'invites')   loadInvites()   }, [adminTab, loadInvites])

  function openEdit(p: Project) {
    setEditId(p.id)
    setEditWallet(p.admin_wallet ?? '')
    setEditEmail(p.contact_email ?? '')
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
        contact_email:    editEmail || null,
        is_verified:      editVerif,
        contract_address: editContract || null,
        github_url:       editGithubUrl || null,
        trust_score:      Math.min(score.total, 110),
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
      <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)', padding: '16px 28px',
        display: 'flex', alignItems: 'center', gap: 14 }}>
        <a href="/" style={{ color: 'var(--muted2)', fontSize: 12, display: 'flex',
          alignItems: 'center', gap: 5, textDecoration: 'none' }}>
          <i className="ph-bold ph-arrow-left" style={{ fontSize: 11 }} /> App
        </a>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          <i className="ph-bold ph-shield-star" style={{ marginRight: 8, color: '#6f9be5' }} />
          Zexus Admin
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)',
          borderRadius: 9, padding: 3, border: '0.5px solid rgba(255,255,255,0.07)' }}>
          {([
            { id: 'projects',  label: 'Projects',  icon: 'ph-buildings'  },
            { id: 'analytics', label: 'Analytics', icon: 'ph-chart-bar'  },
            { id: 'posts',     label: 'Posts',     icon: 'ph-newspaper'  },
            { id: 'predict',   label: 'Predict',   icon: 'ph-trend-up'   },
            { id: 'invites',   label: 'Invites',   icon: 'ph-ticket'     },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setAdminTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px',
                borderRadius: 7, border: 'none', fontFamily: 'inherit', fontSize: 12,
                fontWeight: adminTab === t.id ? 700 : 400, cursor: 'pointer',
                background: adminTab === t.id ? 'rgba(111,155,229,0.15)' : 'transparent',
                color: adminTab === t.id ? '#6f9be5' : 'var(--muted2)',
                transition: 'all 0.15s',
              }}>
              <i className={`ph-bold ${t.icon}`} style={{ fontSize: 13 }} />
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />
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

      {/* ══════════ ANALYTICS TAB ══════════ */}
      {adminTab === 'analytics' && (
        <div>
          {anLoading && !analytics && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '60px 0', fontSize: 13 }}>
              <i className="ph-bold ph-circle-notch spin" style={{ fontSize: 20, marginBottom: 10, display: 'block' }} />
              Loading analytics…
            </div>
          )}
          {analytics && (() => {
            const { platform, zxp, top_holders, top_stakers, onboarding } = analytics
            const postsData    = anRange === '7d' ? analytics.posts_7d    : analytics.posts_30d
            const checkinsData = anRange === '7d' ? analytics.checkins_7d : analytics.checkins_30d

            const fmtNum = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
            const shortW = (w: string) => `${w.slice(0, 6)}…${w.slice(-4)}`

            const card = (val: string | number, label: string, icon: string, color = 'var(--text)', sub?: string) => (
              <div style={{ border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px',
                background: 'rgba(255,255,255,0.015)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase',
                  letterSpacing: '1.2px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className={`ph-bold ${icon}`} /> {label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{fmtNum(Number(val))}</div>
                {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
              </div>
            )

            const totalUsers = platform.total_users
            const onboardingSteps = ['connect', 'reaction', 'comment', 'watchlist'] as const
            const onboardingLabels: Record<string, string> = { connect: 'Connected wallet', reaction: 'Liked a post', comment: 'Left a comment', watchlist: 'Added to watchlist' }
            const onboardingColors: Record<string, string> = { connect: '#6f9be5', reaction: 'var(--red)', comment: 'var(--green)', watchlist: 'var(--gold)' }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Refresh + range */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                    Platform Analytics
                  </div>
                  <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)',
                    borderRadius: 8, padding: 3, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {(['7d', '30d'] as const).map(r => (
                      <button key={r} onClick={() => setAnRange(r)}
                        style={{ padding: '4px 12px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
                          fontSize: 11, fontWeight: anRange === r ? 700 : 400, cursor: 'pointer',
                          background: anRange === r ? 'rgba(111,155,229,0.15)' : 'transparent',
                          color: anRange === r ? '#6f9be5' : 'var(--muted2)' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <button onClick={loadAnalytics} title="Refresh"
                    style={{ padding: '6px 10px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.08)',
                      background: 'transparent', color: 'var(--muted2)', cursor: 'pointer', fontSize: 13 }}>
                    <i className={`ph-bold ph-arrow-clockwise${anLoading ? ' spin' : ''}`} />
                  </button>
                </div>

                {/* Row 1 — Users & Activity */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                  {card(platform.total_users,        'Total Users',     'ph-users',          '#6f9be5', `+${platform.new_users_today} today`)}
                  {card(platform.active_users_7d,    'Active (7d)',      'ph-activity',       'var(--green)')}
                  {card(platform.telegram_connected, 'Telegram Bot',    'ph-telegram-logo',  '#229ED9', `${platform.total_users > 0 ? Math.round((platform.telegram_connected / platform.total_users) * 100) : 0}% of users`)}
                  {card(platform.total_posts,        'Total Posts',     'ph-newspaper',      'var(--text)')}
                  {card(platform.total_checkins,     'Total Check-ins', 'ph-calendar-check', 'var(--gold)')}
                </div>

                {/* Row 2 — Engagement */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                  {card(platform.total_likes,             'Total Likes',    'ph-heart',     'var(--red)')}
                  {card(platform.total_comments,          'Comments',        'ph-chat',      'var(--text)')}
                  {card(platform.total_watchlist_entries, 'Watchlist Adds', 'ph-eye',        '#a78bfa')}
                  {card(platform.total_projects,          'Projects',        'ph-buildings', 'var(--text)')}
                </div>

                {/* Row 3 — ZXP */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                  {card(zxp.total_circulating, 'ZXP Circulating', 'ph-coins',    'var(--gold)', 'balance + staked')}
                  {card(zxp.total_staked,      'ZXP Staked',       'ph-lock',     '#f59e0b', `${zxp.total_circulating > 0 ? Math.round((zxp.total_staked / zxp.total_circulating) * 100) : 0}% of circulating`)}
                  {card(zxp.predict_locked,    'Locked in Predict','ph-scales',   '#a78bfa', `across ${zxp.predict_markets} active market${zxp.predict_markets !== 1 ? 's' : ''}`)}
                  {card(zxp.earned_today,      'ZXP Earned Today', 'ph-trend-up', 'var(--green)')}
                </div>

                {/* Row 4 — Charts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {/* Posts chart */}
                  <div style={{ border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '1.2px', flex: 1 }}>
                        <i className="ph-bold ph-newspaper" style={{ marginRight: 5 }} />Posts · {anRange}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                        {postsData.reduce((s, d) => s + d.count, 0)}
                      </div>
                    </div>
                    <SparkBars data={postsData} color="rgba(111,155,229,0.7)" unit="posts" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9,
                      color: 'var(--muted2)', marginTop: 4 }}>
                      <span>{postsData[0]?.date.slice(5)}</span>
                      <span>{postsData[postsData.length - 1]?.date.slice(5)}</span>
                    </div>
                  </div>

                  {/* Check-ins chart */}
                  <div style={{ border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '1.2px', flex: 1 }}>
                        <i className="ph-bold ph-calendar-check" style={{ marginRight: 5 }} />Check-ins · {anRange}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                        {checkinsData.reduce((s, d) => s + d.count, 0)}
                      </div>
                    </div>
                    <SparkBars data={checkinsData} color="rgba(201,165,90,0.7)" unit="check-ins" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9,
                      color: 'var(--muted2)', marginTop: 4 }}>
                      <span>{checkinsData[0]?.date.slice(5)}</span>
                      <span>{checkinsData[checkinsData.length - 1]?.date.slice(5)}</span>
                    </div>
                  </div>
                </div>

                {/* Row 5 — ZXP Circulating Supply chart */}
                {(() => {
                  const supply = analytics.zxp_supply ?? []
                  const last   = supply[supply.length - 1]
                  const prev   = supply[supply.length - 2]
                  const delta  = last && prev ? last.circulating - prev.circulating : null
                  return (
                    <div style={{ border: '0.5px solid rgba(201,165,90,0.2)', borderRadius: 12, padding: '16px 18px',
                      background: 'rgba(201,165,90,0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase',
                            letterSpacing: '1.2px', marginBottom: 6 }}>
                            <i className="ph-bold ph-coins" style={{ marginRight: 5, color: 'var(--gold)' }} />
                            ZXP Circulating Supply
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>
                              {last ? last.circulating.toLocaleString() : '—'}
                            </span>
                            {delta !== null && (
                              <span style={{ fontSize: 12, fontWeight: 600,
                                color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {delta >= 0 ? '+' : ''}{delta.toLocaleString()} vs yesterday
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 4 }}>
                            {supply.length} day{supply.length !== 1 ? 's' : ''} tracked
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: 'var(--muted2)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="rgba(201,165,90,0.9)" strokeWidth="1.8" /></svg>
                              Circulating
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="rgba(245,158,11,0.5)" strokeWidth="1.2" strokeDasharray="3 3" /></svg>
                              Staked
                            </span>
                          </div>
                        </div>
                      </div>
                      <SparkLine data={supply} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9,
                        color: 'var(--muted2)', marginTop: 6 }}>
                        <span>{supply[0]?.date ?? ''}</span>
                        <span>{supply[supply.length - 1]?.date ?? ''}</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Row 6 — Onboarding funnel + Top holders + Top stakers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

                  {/* Onboarding funnel */}
                  <div style={{ border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase',
                      letterSpacing: '1.2px', marginBottom: 14 }}>
                      <i className="ph-bold ph-funnel" style={{ marginRight: 5 }} />Onboarding Funnel
                    </div>
                    {onboardingSteps.map(step => {
                      const n    = onboarding[step] ?? 0
                      const pct  = totalUsers > 0 ? Math.round((n / totalUsers) * 100) : 0
                      const color = onboardingColors[step]
                      return (
                        <div key={step} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--text)' }}>{onboardingLabels[step]}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color }}>
                              {fmtNum(n)} <span style={{ color: 'var(--muted2)', fontWeight: 400 }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Top ZXP holders */}
                  <div style={{ border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase',
                      letterSpacing: '1.2px', marginBottom: 12 }}>
                      <i className="ph-bold ph-trophy" style={{ marginRight: 5 }} />Top ZXP Holders
                    </div>
                    {top_holders.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>No data</div>
                    )}
                    {top_holders.map((h, i) => (
                      <div key={h.wallet} style={{ display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', borderBottom: i < top_holders.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, width: 18, textAlign: 'right', flexShrink: 0,
                          color: i === 0 ? 'var(--gold)' : i === 1 ? 'rgba(200,200,200,0.7)' : i === 2 ? '#cd7f32' : 'var(--muted2)' }}>
                          #{h.rank}
                        </span>
                        <span style={{ flex: 1, fontSize: 10, color: 'var(--text)', fontFamily: 'monospace',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {shortW(h.wallet)}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--muted2)', flexShrink: 0 }}>
                          <i className="ph-bold ph-calendar" style={{ fontSize: 8, marginRight: 2 }} />{h.streak}d
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>
                          {fmtNum(h.balance)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Top ZXP stakers */}
                  <div style={{ border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase',
                      letterSpacing: '1.2px', marginBottom: 12 }}>
                      <i className="ph-bold ph-lock" style={{ marginRight: 5 }} />Top Stakers
                    </div>
                    {top_stakers.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>No stakers yet</div>
                    )}
                    {top_stakers.map((h, i) => (
                      <div key={h.wallet} style={{ display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', borderBottom: i < top_stakers.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, width: 18, textAlign: 'right', flexShrink: 0,
                          color: i === 0 ? 'var(--gold)' : i === 1 ? 'rgba(200,200,200,0.7)' : i === 2 ? '#cd7f32' : 'var(--muted2)' }}>
                          #{h.rank}
                        </span>
                        <span style={{ flex: 1, fontSize: 10, color: 'var(--text)', fontFamily: 'monospace',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {shortW(h.wallet)}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', flexShrink: 0 }}>
                          {fmtNum(h.staked)} ZXP
                        </span>
                      </div>
                    ))}
                  </div>

                </div>

              </div>
            )
          })()}
        </div>
      )}

      {/* ══════════ POSTS TAB ══════════ */}
      {adminTab === 'posts' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <i className="ph-bold ph-magnifying-glass"
                style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted2)', fontSize: 12 }} />
              <input
                value={modSearch}
                onChange={e => setModSearch(e.target.value)}
                placeholder="Search posts by project or content…"
                style={{ width: '100%', padding: '8px 12px 8px 32px',
                  background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.09)',
                  borderRadius: 9, color: 'var(--text)', fontSize: 13,
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted2)', flexShrink: 0 }}>
              {modPosts.length} posts
            </span>
            <button onClick={loadPosts} title="Refresh"
              style={{ padding: '8px 12px', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: 'var(--muted2)', cursor: 'pointer', fontSize: 14 }}>
              <i className={`ph-bold ph-arrow-clockwise${modLoading ? ' spin' : ''}`} />
            </button>
          </div>

          {/* Posts list */}
          {modLoading && !modPosts.length ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 13 }}>
              Loading…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {modPosts
                .filter(p => {
                  const q = modSearch.toLowerCase()
                  return !q ||
                    p.project_name.toLowerCase().includes(q) ||
                    (p.title ?? '').toLowerCase().includes(q) ||
                    p.content.toLowerCase().includes(q)
                })
                .map(p => {
                  const TYPE_COLOR: Record<string, string> = {
                    alert: 'var(--red)', verdict: 'var(--green)',
                    update: '#6f9be5', new: 'var(--gold)', investment: '#a78bfa',
                  }
                  const isDelConfirm = modDelId === p.id
                  const timeAgo = (() => {
                    const diff = Date.now() - new Date(p.created_at).getTime()
                    const m = Math.floor(diff / 60000)
                    if (m < 60) return `${m}m ago`
                    const h = Math.floor(m / 60)
                    if (h < 24) return `${h}h ago`
                    return `${Math.floor(h / 24)}d ago`
                  })()

                  return (
                    <div key={p.id} style={{
                      border: isDelConfirm
                        ? '0.5px solid rgba(238,121,121,0.4)'
                        : '0.5px solid rgba(255,255,255,0.06)',
                      borderRadius: 10, padding: '12px 14px',
                      background: isDelConfirm ? 'rgba(238,121,121,0.04)' : 'transparent',
                      transition: 'border-color 0.2s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

                        {/* Project avatar */}
                        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                          background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                          {p.avatar_url
                            ? <img src={p.avatar_url} alt="" style={{ width: 32, height: 32, objectFit: 'cover' }} />
                            : (p.project_name?.[0] ?? '?').toUpperCase()}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                              {p.project_name}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                              color: TYPE_COLOR[p.post_type] ?? 'var(--muted)',
                              background: `${TYPE_COLOR[p.post_type] ?? 'rgba(255,255,255,0.1)'}18`,
                              border: `0.5px solid ${TYPE_COLOR[p.post_type] ?? 'rgba(255,255,255,0.08)'}40`,
                              textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {p.post_type}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--muted2)', marginLeft: 'auto' }}>{timeAgo}</span>
                          </div>
                          {p.title && (
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.title}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.content.slice(0, 120)}{p.content.length > 120 ? '…' : ''}
                          </div>
                          <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                            <span style={{ fontSize: 10, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <i className="ph-fill ph-heart" style={{ fontSize: 9, color: 'var(--red)' }} />
                              {p.like_count ?? 0}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <i className="ph-bold ph-chat" style={{ fontSize: 9 }} />
                              {p.comment_count ?? 0}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <i className="ph-bold ph-eye" style={{ fontSize: 9 }} />
                              {p.view_count ?? 0}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: 'monospace' }}>
                              {p.id.slice(0, 8)}…
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {p.project_slug && (
                            <a href={`/projects/${p.project_slug}`} target="_blank" rel="noopener noreferrer"
                              style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, textDecoration: 'none',
                                border: '0.5px solid rgba(255,255,255,0.08)', background: 'transparent',
                                color: 'var(--muted2)', display: 'flex', alignItems: 'center' }}
                              title="View project">
                              <i className="ph-bold ph-arrow-square-out" />
                            </a>
                          )}
                          <button
                            onClick={() => setModDelId(isDelConfirm ? null : p.id)}
                            style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                              border: isDelConfirm ? '0.5px solid rgba(238,121,121,0.5)' : '0.5px solid rgba(238,121,121,0.2)',
                              background: isDelConfirm ? 'rgba(238,121,121,0.12)' : 'transparent',
                              color: 'var(--red)', opacity: 0.85 }}
                            title="Delete post">
                            <i className={`ph-bold ${isDelConfirm ? 'ph-x' : 'ph-trash'}`} />
                          </button>
                        </div>
                      </div>

                      {/* Delete confirmation */}
                      {isDelConfirm && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(238,121,121,0.2)',
                          display: 'flex', alignItems: 'center', gap: 10 }}>
                          <i className="ph-bold ph-warning" style={{ color: 'var(--red)', fontSize: 13 }} />
                          <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>
                            Удалить этот пост? Действие необратимо.
                          </span>
                          <button
                            onClick={() => deletePost(p.id)}
                            disabled={modDeleting}
                            style={{ padding: '6px 16px', borderRadius: 7, fontFamily: 'inherit',
                              border: '0.5px solid rgba(238,121,121,0.5)',
                              background: 'rgba(238,121,121,0.15)', color: 'var(--red)',
                              fontSize: 12, fontWeight: 700, cursor: modDeleting ? 'not-allowed' : 'pointer',
                              opacity: modDeleting ? 0.6 : 1 }}>
                            {modDeleting ? 'Deleting…' : 'Confirm Delete'}
                          </button>
                          <button
                            onClick={() => setModDelId(null)}
                            style={{ padding: '6px 12px', borderRadius: 7, fontFamily: 'inherit',
                              border: '0.5px solid rgba(255,255,255,0.07)', background: 'transparent',
                              color: 'var(--muted2)', fontSize: 12, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              {modPosts.length === 0 && !modLoading && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 13 }}>
                  No posts yet
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════ PROJECTS TAB ══════════ */}
      {adminTab === 'projects' && (
        <div>

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
                { label: 'ADMIN WALLET',   key: 'admin_wallet',  ph: '0x…' },
                { label: 'WEBSITE',        key: 'website_url',   ph: 'https://…' },
                { label: 'CONTACT EMAIL',  key: 'contact_email', ph: 'team@project.xyz' },
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
                        { label: 'ADMIN WALLET',   val: editWallet, set: setEditWallet, ph: '0x…',               mono: true  },
                        { label: 'CONTACT EMAIL',  val: editEmail,  set: setEditEmail,  ph: 'team@project.xyz',   mono: false },
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
      )}

      {/* ══════════ PREDICT TAB ══════════ */}
      {adminTab === 'predict' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Predict Markets</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Create and resolve prediction markets for the community
              </div>
            </div>
            <button
              onClick={() => { setPredShowForm(v => !v); setPredErr(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                background: 'rgba(111,155,229,0.12)', border: '0.5px solid rgba(111,155,229,0.35)',
                borderRadius: 8, color: '#6f9be5', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <i className="ph-bold ph-plus" /> New Market
            </button>
          </div>

          {/* Create form */}
          {predShowForm && (
            <div style={{ background: 'rgba(111,155,229,0.05)', border: '0.5px solid rgba(111,155,229,0.2)',
              borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6f9be5', marginBottom: 2 }}>
                <i className="ph-bold ph-trend-up" style={{ marginRight: 6 }} />New Prediction Market
              </div>

              <div className="create-field" style={{ marginBottom: 0 }}>
                <label className="create-label">TITLE *</label>
                <input className="create-input" placeholder="Will Zexus reach 1,000 users by August?"
                  value={predForm.title} onChange={e => setPredForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div className="create-field" style={{ marginBottom: 0 }}>
                <label className="create-label">DESCRIPTION (optional)</label>
                <textarea className="create-textarea" rows={2} placeholder="Additional context…"
                  value={predForm.description} onChange={e => setPredForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="create-field" style={{ marginBottom: 0 }}>
                  <label className="create-label">CATEGORY</label>
                  <select className="create-input" value={predForm.category}
                    onChange={e => setPredForm(f => ({ ...f, category: e.target.value }))}>
                    {['Platform', 'Ecosystem', 'Community', 'Token', 'Partnership', 'Other'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="create-field" style={{ marginBottom: 0 }}>
                  <label className="create-label">PROJECT NAME (optional)</label>
                  <input className="create-input" placeholder="AeroBase, Zexus…"
                    value={predForm.project_name} onChange={e => setPredForm(f => ({ ...f, project_name: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="create-field" style={{ marginBottom: 0 }}>
                  <label className="create-label">OPTION A (Yes side)</label>
                  <input className="create-input" placeholder="Yes"
                    value={predForm.option_a} onChange={e => setPredForm(f => ({ ...f, option_a: e.target.value }))} />
                </div>
                <div className="create-field" style={{ marginBottom: 0 }}>
                  <label className="create-label">OPTION B (No side)</label>
                  <input className="create-input" placeholder="No"
                    value={predForm.option_b} onChange={e => setPredForm(f => ({ ...f, option_b: e.target.value }))} />
                </div>
              </div>

              <div className="create-field" style={{ marginBottom: 0 }}>
                <label className="create-label">CLOSES AT *</label>
                <input className="create-input" type="datetime-local"
                  value={predForm.closes_at} onChange={e => setPredForm(f => ({ ...f, closes_at: e.target.value }))} />
              </div>

              {predErr && (
                <div style={{ fontSize: 12, color: 'var(--red)', padding: '6px 10px',
                  background: 'rgba(238,121,121,0.08)', borderRadius: 6 }}>{predErr}</div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={predSaving}
                  onClick={async () => {
                    if (!predForm.title.trim() || !predForm.closes_at) {
                      setPredErr('Title and closing date are required'); return
                    }
                    setPredSaving(true); setPredErr(null)
                    try {
                      const r = await fetch('/api/predict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...predForm, wallet: address }),
                      })
                      const d = await r.json() as { error?: string }
                      if (!r.ok) { setPredErr(d.error ?? 'Failed to create'); return }
                      setPredShowForm(false)
                      setPredForm({ title: '', description: '', category: 'Platform',
                        option_a: 'Yes', option_b: 'No', closes_at: '', project_name: '' })
                      await loadPredict()
                    } finally { setPredSaving(false) }
                  }}
                  style={{ padding: '9px 20px', background: 'rgba(111,155,229,0.15)',
                    border: '0.5px solid rgba(111,155,229,0.4)', borderRadius: 8,
                    color: '#6f9be5', fontSize: 13, fontWeight: 600,
                    cursor: predSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  {predSaving ? 'Creating…' : 'Create Market'}
                </button>
                <button onClick={() => { setPredShowForm(false); setPredErr(null) }}
                  style={{ padding: '9px 16px', background: 'transparent',
                    border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8,
                    color: 'var(--muted2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Markets list */}
          {predLoading && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 13 }}>Loading…</div>
          )}

          {!predLoading && predMarkets.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px 0', fontSize: 13 }}>
              No markets yet — create the first one above.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {predMarkets.map(m => {
              const total = m.pool_a + m.pool_b
              const pctA  = total ? Math.round((m.pool_a / total) * 100) : 50
              const pctB  = 100 - pctA
              const isResolving = resolvingId === m.id

              return (
                <div key={m.id} style={{ background: 'rgba(255,255,255,0.02)',
                  border: `0.5px solid ${m.status === 'resolved' ? 'rgba(101,191,127,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 12, padding: '16px 18px' }}>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                          color: 'var(--muted2)', fontWeight: 600 }}>{m.category}</span>
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 600,
                          background: m.status === 'open'     ? 'rgba(101,191,127,0.12)' :
                                      m.status === 'resolved' ? 'rgba(111,155,229,0.12)' : 'rgba(255,255,255,0.05)',
                          color:      m.status === 'open'     ? 'var(--green)' :
                                      m.status === 'resolved' ? '#6f9be5'      : 'var(--muted2)',
                        }}>
                          {m.status === 'open' ? 'Open' : m.status === 'resolved' ? 'Resolved' : 'Closed'}
                        </span>
                        {m.status === 'resolved' && m.outcome && (
                          <span style={{ fontSize: 10, color: 'var(--green)' }}>
                            Winner: {m.outcome === 'a' ? m.option_a : m.option_b}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>{m.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                        Closes {new Date(m.closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {m.project_name && <> · {m.project_name}</>}
                        {' · '}{total.toLocaleString()} ZXP pool
                      </div>
                    </div>
                    {m.status !== 'resolved' && (
                      <button
                        onClick={() => { setResolvingId(m.id); setResolveOutcome(null); setResolveMsg(null) }}
                        style={{ flexShrink: 0, padding: '6px 12px', fontSize: 11, fontWeight: 600,
                          background: 'rgba(101,191,127,0.1)', border: '0.5px solid rgba(101,191,127,0.3)',
                          borderRadius: 7, color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Resolve
                      </button>
                    )}
                  </div>

                  {/* Mini bar */}
                  <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
                    <span style={{ color: 'var(--green)' }}>{m.option_a} {pctA}%</span>
                    <span>·</span>
                    <span style={{ color: 'var(--red)' }}>{m.option_b} {pctB}%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ display: 'flex', height: '100%' }}>
                      <div style={{ width: `${pctA}%`, background: 'var(--green)' }} />
                      <div style={{ width: `${pctB}%`, background: 'var(--red)' }} />
                    </div>
                  </div>

                  {/* Resolve panel */}
                  {isResolving && (
                    <div style={{ padding: '12px 14px', background: 'rgba(101,191,127,0.05)',
                      border: '0.5px solid rgba(101,191,127,0.2)', borderRadius: 8,
                      display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                        Pick the winning option:
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['a', 'b'] as const).map(opt => (
                          <button key={opt}
                            onClick={() => setResolveOutcome(opt)}
                            style={{ flex: 1, padding: '8px 12px', borderRadius: 8,
                              border: `0.5px solid ${resolveOutcome === opt
                                ? (opt === 'a' ? 'rgba(101,191,127,0.6)' : 'rgba(238,121,121,0.6)')
                                : 'rgba(255,255,255,0.07)'}`,
                              background: resolveOutcome === opt
                                ? (opt === 'a' ? 'rgba(101,191,127,0.12)' : 'rgba(238,121,121,0.12)')
                                : 'transparent',
                              color: resolveOutcome === opt
                                ? (opt === 'a' ? 'var(--green)' : 'var(--red)')
                                : 'var(--muted2)',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                              transition: 'all 0.15s' }}>
                            {opt === 'a' ? `✓ ${m.option_a}` : `✗ ${m.option_b}`}
                          </button>
                        ))}
                      </div>
                      {resolveMsg && (
                        <div style={{ fontSize: 11, color: 'var(--green)' }}>{resolveMsg}</div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={!resolveOutcome || resolveBusy}
                          onClick={async () => {
                            if (!resolveOutcome || !address) return
                            setResolveBusy(true)
                            try {
                              const r = await fetch(`/api/predict/${m.id}/resolve`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ wallet: address, outcome: resolveOutcome }),
                              })
                              const d = await r.json() as { error?: string; winners?: number; paid?: number }
                              if (!r.ok) { setResolveMsg(d.error ?? 'Failed'); return }
                              setResolveMsg(`Resolved! ${d.winners} winners, ${d.paid} ZXP paid out.`)
                              await loadPredict()
                              setTimeout(() => { setResolvingId(null); setResolveMsg(null) }, 3000)
                            } finally { setResolveBusy(false) }
                          }}
                          style={{ padding: '8px 18px', background: 'rgba(101,191,127,0.15)',
                            border: '0.5px solid rgba(101,191,127,0.4)', borderRadius: 8,
                            color: 'var(--green)', fontSize: 12, fontWeight: 600,
                            cursor: (!resolveOutcome || resolveBusy) ? 'not-allowed' : 'pointer',
                            opacity: (!resolveOutcome || resolveBusy) ? 0.5 : 1, fontFamily: 'inherit' }}>
                          {resolveBusy ? 'Processing…' : 'Confirm & Pay Out'}
                        </button>
                        <button onClick={() => { setResolvingId(null); setResolveOutcome(null); setResolveMsg(null) }}
                          style={{ padding: '8px 14px', background: 'transparent',
                            border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8,
                            color: 'var(--muted2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════ INVITES TAB ══════════ */}
      {adminTab === 'invites' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Invite Codes</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {invites.filter(c => c.used_at).length} used · {invites.filter(c => !c.used_at).length} unused
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={loadInvites} title="Refresh"
                style={{ padding: '8px 12px', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.08)',
                  background: 'transparent', color: 'var(--muted2)', cursor: 'pointer', fontSize: 14 }}>
                <i className={`ph-bold ph-arrow-clockwise${invLoading ? ' spin' : ''}`} />
              </button>
              <button onClick={() => { setInvShowForm(v => !v); setInvErr(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  background: 'rgba(111,155,229,0.12)', border: '0.5px solid rgba(111,155,229,0.35)',
                  borderRadius: 8, color: '#6f9be5', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit' }}>
                <i className={`ph-bold ${invShowForm ? 'ph-x' : 'ph-plus'}`} />
                {invShowForm ? 'Cancel' : 'New Code'}
              </button>
            </div>
          </div>

          {/* Add form */}
          {invShowForm && (
            <div style={{ background: 'rgba(111,155,229,0.05)', border: '0.5px solid rgba(111,155,229,0.2)',
              borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'CODE *', key: 'code', ph: 'AERO24' },
                  { label: 'PROJECT NAME', key: 'project_name', ph: 'Aerodrome' },
                  { label: 'NOTE', key: 'note', ph: 'Outreach DM' },
                ].map(f => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px' }}>{f.label}</label>
                    <input
                      value={invForm[f.key as keyof typeof invForm]}
                      onChange={e => setInvForm(v => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                      style={{ padding: '8px 11px', background: 'rgba(255,255,255,0.03)',
                        border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 8,
                        color: 'var(--text)', fontSize: 13, fontFamily: f.key === 'code' ? 'monospace' : 'inherit',
                        outline: 'none', textTransform: f.key === 'code' ? 'uppercase' : 'none' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 220 }}>
                <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px' }}>
                  EXPIRES <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <input
                  type="date"
                  value={invForm.expires_at}
                  onChange={e => setInvForm(v => ({ ...v, expires_at: e.target.value }))}
                  style={{ padding: '8px 11px', background: 'rgba(255,255,255,0.03)',
                    border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 8,
                    color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                    colorScheme: 'dark' }}
                />
              </div>
              {invErr && <div style={{ fontSize: 12, color: 'var(--red)' }}>{invErr}</div>}
              <button
                disabled={invSaving || !invForm.code.trim()}
                onClick={async () => {
                  setInvSaving(true); setInvErr(null)
                  try {
                    const r = await fetch('/api/admin/invites', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ wallet: address, ...invForm }),
                    })
                    const d = await r.json() as { error?: string }
                    if (!r.ok) { setInvErr(d.error ?? 'Failed'); return }
                    setInvForm({ code: '', project_name: '', note: '', expires_at: '' })
                    setInvShowForm(false)
                    await loadInvites()
                  } finally { setInvSaving(false) }
                }}
                style={{ padding: '9px', borderRadius: 8, border: '0.5px solid rgba(111,155,229,0.4)',
                  background: 'rgba(111,155,229,0.12)', color: '#6f9be5', fontSize: 13,
                  fontWeight: 600, cursor: invSaving || !invForm.code.trim() ? 'not-allowed' : 'pointer',
                  opacity: invSaving || !invForm.code.trim() ? 0.5 : 1, fontFamily: 'inherit' }}>
                {invSaving ? 'Creating…' : 'Create Code'}
              </button>
            </div>
          )}

          {/* Codes list */}
          {invLoading && !invites.length ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {invites.map(c => (
                <div key={c.code} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', borderRadius: 10,
                  background: c.used_at ? 'rgba(255,255,255,0.01)' : 'rgba(111,155,229,0.04)',
                  border: `0.5px solid ${c.used_at ? 'rgba(255,255,255,0.05)' : 'rgba(111,155,229,0.15)'}`,
                }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
                    color: c.used_at ? 'var(--muted)' : 'var(--text)', letterSpacing: '1px', flexShrink: 0 }}>
                    {c.code}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>
                    {c.project_name ?? '—'}
                    {c.note && <span style={{ color: 'var(--muted2)', marginLeft: 8 }}>· {c.note}</span>}
                  </span>
                  {(() => {
                    const expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now()
                    const expLabel = c.expires_at
                      ? new Date(c.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : null
                    return (
                      <span style={{ fontSize: 11, flexShrink: 0, textAlign: 'right',
                        color: expired ? 'var(--red)' : c.used_at ? 'var(--green)' : 'var(--muted2)' }}>
                        {expired
                          ? 'Expired'
                          : c.used_at
                            ? `Used ${new Date(c.used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            : 'Unused'}
                        {expLabel && !expired && (
                          <span style={{ color: 'var(--muted2)', marginLeft: 6 }}>· exp {expLabel}</span>
                        )}
                      </span>
                    )
                  })()}
                  {invDelCode === c.code ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={async () => {
                        await fetch('/api/admin/invites', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ wallet: address, code: c.code }),
                        })
                        setInvDelCode(null)
                        await loadInvites()
                      }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        border: '0.5px solid rgba(238,121,121,0.5)', background: 'rgba(238,121,121,0.12)',
                        color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Confirm
                      </button>
                      <button onClick={() => setInvDelCode(null)}
                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11,
                          border: '0.5px solid rgba(255,255,255,0.07)', background: 'transparent',
                          color: 'var(--muted2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setInvDelCode(c.code)}
                      style={{ padding: '5px 8px', borderRadius: 7, fontSize: 12, flexShrink: 0,
                        border: '0.5px solid rgba(238,121,121,0.2)', background: 'transparent',
                        color: 'var(--red)', opacity: 0.6, cursor: 'pointer' }}>
                      <i className="ph-bold ph-trash" />
                    </button>
                  )}
                </div>
              ))}
              {invites.length === 0 && !invLoading && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 13 }}>
                  No invite codes yet
                </div>
              )}
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  )
}
