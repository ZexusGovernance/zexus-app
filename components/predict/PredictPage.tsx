'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'

interface PredictMarket {
  id:           string
  title:        string
  description:  string | null
  category:     string
  project_name: string | null
  option_a:     string
  option_b:     string
  pool_a:       number
  pool_b:       number
  status:       'open' | 'closed' | 'resolved'
  outcome:      'a' | 'b' | null
  closes_at:    string
  resolved_at:  string | null
  participants: number
  user_bet:     { option: string; amount: number; payout: number | null } | null
}

type Tab = 'Active' | 'My bets' | 'Completed'

function timeLeft(closes_at: string): string {
  const ms = new Date(closes_at).getTime() - Date.now()
  if (ms <= 0) return 'Closed'
  const days    = Math.floor(ms / 86_400_000)
  const hours   = Math.floor((ms % 86_400_000) / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1_000)
  if (days > 0)  return `${days}d left`
  if (hours > 0) return `${hours}h left`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function odds(poolA: number, poolB: number) {
  const total = poolA + poolB
  if (!total) return { pctA: 50, pctB: 50 }
  const pctA = Math.round((poolA / total) * 100)
  return { pctA, pctB: 100 - pctA }
}

function estPayout(m: PredictMarket, opt: 'a' | 'b', betAmt: number): number {
  const total  = m.pool_a + m.pool_b + betAmt
  const myPool = (opt === 'a' ? m.pool_a : m.pool_b) + betAmt
  return myPool > 0 ? Math.floor((betAmt / myPool) * total * 0.98) : 0
}

export default function PredictPage() {
  const { address, isConnected } = useAppKitAccount()
  const [tab,       setTab]      = useState<Tab>('Active')
  const [markets,   setMarkets]  = useState<PredictMarket[]>([])
  const [loading,   setLoading]  = useState(true)
  const [bettingOn, setBettingOn] = useState<{ id: string; option: 'a' | 'b' } | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [betBusy,   setBetBusy]  = useState(false)
  const [betError,  setBetError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // Live countdown — ticks every second when any market closes within 1 hour
  useEffect(() => {
    const hasHot = markets.some(
      m => m.status === 'open' && new Date(m.closes_at).getTime() - Date.now() < 3_600_000,
    )
    if (!hasHot) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [markets])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/predict${address ? `?wallet=${address}` : ''}`
      const d   = await fetch(url).then(r => r.json()) as { markets?: PredictMarket[] }
      setMarkets(d.markets ?? [])
    } finally { setLoading(false) }
  }, [address])

  useEffect(() => { load() }, [load])

  async function placeBet(marketId: string, option: 'a' | 'b') {
    if (!address) return
    const amount = parseInt(betAmount)
    if (!amount || amount < 1) { setBetError('Enter amount (min 1 ZXP)'); return }
    setBetBusy(true)
    setBetError(null)
    try {
      const r = await fetch(`/api/predict/${marketId}/bet`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ wallet: address, option, amount }),
      })
      const d = await r.json() as { error?: string }
      if (!r.ok) { setBetError(d.error ?? 'Bet failed'); return }
      setBettingOn(null)
      setBetAmount('')
      await load()
    } finally { setBetBusy(false) }
  }

  const openMarkets = markets.filter(m => m.status === 'open')
  const myBets      = markets.filter(m => m.user_bet)
  const completed   = markets.filter(m => m.status !== 'open')
  const displayed   = tab === 'Active' ? openMarkets : tab === 'My bets' ? myBets : completed

  return (
    <div className="page active" id="page-predict">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        <div className="page-header">
          <div className="page-title">Predict Market</div>
          <div className="page-sub">Bet ZXP on Zexus platform events · Parimutuel · 2% fee burned</div>
          <div className="tabs">
            {(['Active', 'My bets', 'Completed'] as Tab[]).map(t => (
              <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t}{t === 'Active' && openMarkets.length > 0 ? ` (${openMarkets.length})` : ''}
              </div>
            ))}
          </div>
        </div>

        <div className="scroll">
          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px 0', fontSize: 12 }}>
              Loading…
            </div>
          )}

          {!loading && displayed.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 10, padding: '60px 20px', textAlign: 'center' }}>
              <i className="ph-bold ph-trend-up" style={{ fontSize: 32, opacity: 0.18 }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>
                {tab === 'My bets'  ? 'No bets yet'
                 : tab === 'Active' ? 'No open markets right now'
                 :                    'No completed markets'}
              </div>
              {tab === 'My bets' && openMarkets.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--muted2)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setTab('Active')}>Browse active markets →</span>
              )}
            </div>
          )}

          <div className="pred-grid">
            {displayed.map(m => {
              const { pctA, pctB } = odds(m.pool_a, m.pool_b)
              const total      = m.pool_a + m.pool_b
              const isMine     = bettingOn?.id === m.id
              const betOpt     = bettingOn?.option
              const betAmt     = parseInt(betAmount) || 0
              const hot        = new Date(m.closes_at).getTime() - Date.now() < 3 * 86_400_000
              const isResolved = m.status === 'resolved'
              const wonBet     = m.user_bet && m.user_bet.option === m.outcome

              return (
                <div key={m.id}
                  className={`pcard${m.user_bet ? ' mine' : ''}${isResolved ? ' resolved' : ''}`}>

                  {m.user_bet && (
                    <div className="my-stake-tag">
                      <i className="ph-bold ph-coin" style={{ fontSize: 11 }} />
                      {' '}My bet: {m.user_bet.amount} ZXP → {m.user_bet.option === 'a' ? m.option_a : m.option_b}
                      {isResolved && (
                        wonBet
                          ? <span style={{ color: 'var(--green)', marginLeft: 6, fontWeight: 600 }}>
                              +{m.user_bet.payout ?? '?'} won ✓
                            </span>
                          : <span style={{ color: 'var(--red)', marginLeft: 6 }}>Lost</span>
                      )}
                    </div>
                  )}

                  <div className="pcard-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pcard-cat">
                        {m.category}{m.project_name ? ` · ${m.project_name}` : ''}
                      </div>
                      <div className="pcard-title">{m.title}</div>
                      {m.description && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, lineHeight: 1.55 }}>
                          {m.description}
                        </div>
                      )}
                    </div>
                    {m.status === 'open' && (
                      <div className={`ptimer${hot ? ' hot' : ''}`}>
                        <i className="ph-bold ph-clock" /> {timeLeft(m.closes_at)}
                      </div>
                    )}
                    {isResolved && (
                      <div className="ptimer" style={{ color: 'var(--green)' }}>
                        <i className="ph-bold ph-check-circle" /> Resolved
                      </div>
                    )}
                    {m.status === 'closed' && (
                      <div className="ptimer" style={{ color: 'var(--muted2)' }}>
                        <i className="ph-bold ph-lock-simple" /> Pending
                      </div>
                    )}
                  </div>

                  <div className="split-labels">
                    <span className={`sl-yes${m.outcome === 'a' ? ' winner' : ''}`}>
                      {m.outcome === 'a' && <i className="ph-bold ph-trophy" style={{ marginRight: 3, fontSize: 9 }} />}
                      {m.option_a} · {pctA}%
                    </span>
                    <span className={`sl-no${m.outcome === 'b' ? ' winner' : ''}`}>
                      {m.outcome === 'b' && <i className="ph-bold ph-trophy" style={{ marginRight: 3, fontSize: 9 }} />}
                      {m.option_b} · {pctB}%
                    </span>
                  </div>
                  <div className="split-bar">
                    <div className="sb-yes" style={{ width: `${pctA}%` }} />
                    <div className="sb-no"  style={{ width: `${pctB}%` }} />
                  </div>

                  <div className="pool-row">
                    <span>Pool: <span className="pool-val">{total.toLocaleString()} ZXP</span></span>
                    <span>{m.participants} participant{m.participants !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Bet buttons */}
                  {m.status === 'open' && !m.user_bet && isConnected && !isMine && (
                    <div className="bet-row">
                      <button className="bet-btn bb-yes"
                        onClick={() => { setBettingOn({ id: m.id, option: 'a' }); setBetError(null); setBetAmount('') }}>
                        <i className="ph-bold ph-check" /> {m.option_a}
                      </button>
                      <button className="bet-btn bb-no"
                        onClick={() => { setBettingOn({ id: m.id, option: 'b' }); setBetError(null); setBetAmount('') }}>
                        <i className="ph-bold ph-x" /> {m.option_b}
                      </button>
                    </div>
                  )}

                  {/* Bet amount input */}
                  {isMine && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Betting on{' '}
                        <strong style={{ color: betOpt === 'a' ? 'var(--green)' : 'var(--red)' }}>
                          {betOpt === 'a' ? m.option_a : m.option_b}
                        </strong>
                        {betAmt >= 1 && (
                          <span style={{ marginLeft: 6, color: 'var(--muted2)' }}>
                            · Est. ~{estPayout(m, betOpt!, betAmt)} ZXP back
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          className="create-input"
                          style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
                          placeholder="ZXP amount"
                          min={1}
                          value={betAmount}
                          onChange={e => setBetAmount(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && placeBet(m.id, betOpt!)}
                          autoFocus
                        />
                        <button
                          className={`bet-btn ${betOpt === 'a' ? 'bb-yes' : 'bb-no'}`}
                          style={{ flexShrink: 0, padding: '7px 16px' }}
                          onClick={() => placeBet(m.id, betOpt!)}
                          disabled={betBusy}
                        >
                          {betBusy ? '…' : 'Confirm'}
                        </button>
                        <button
                          className="bet-btn"
                          style={{ flexShrink: 0, padding: '7px 10px',
                            background: 'transparent', color: 'var(--muted2)',
                            border: '0.5px solid rgba(255,255,255,0.08)' }}
                          onClick={() => setBettingOn(null)}
                        >✕</button>
                      </div>
                      {betError && <div style={{ fontSize: 11, color: 'var(--red)' }}>{betError}</div>}
                    </div>
                  )}

                  {m.status === 'open' && !m.user_bet && !isConnected && (
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted2)',
                      textAlign: 'center', padding: '4px 0' }}>
                      Connect wallet to place a bet
                    </div>
                  )}

                  {m.status === 'open' && m.user_bet && !isMine && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted2)', textAlign: 'center' }}>
                      Awaiting resolution
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="right" />
    </div>
  )
}
