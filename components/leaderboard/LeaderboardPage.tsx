'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAppKitAccount } from '@reown/appkit/react'

interface Row {
  rank:   number
  wallet: string
  xp:     number
  name:   string | null
  avatar: string | null
}
interface Board {
  season:        string
  days_left:     number
  total_players: number
  top:           Row[]
  me:            { rank: number; wallet: string; xp: number } | null
}

function shortAddr(w: string) {
  return `${w.slice(0, 6)}…${w.slice(-4)}`
}

function rankColor(rank: number): string {
  if (rank === 1) return 'var(--gold)'
  if (rank === 2) return '#c8c8d0'
  if (rank === 3) return '#cd8b5a'
  return 'var(--muted2)'
}

function Medal({ rank }: { rank: number }) {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800,
      color: 'var(--muted)',
      background: 'transparent',
      border: '0.5px solid var(--border)',
    }}>
      {rank}
    </div>
  )
}

export default function LeaderboardPage() {
  const { address } = useAppKitAccount()
  const [board, setBoard]     = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = address ? `?wallet=${encodeURIComponent(address.toLowerCase())}` : ''
    fetch(`/api/leaderboard${q}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setBoard(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [address])

  const monthLabel = board
    ? new Date(`${board.season}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : ''

  const meInTop = board?.me && board.top.some(t => t.wallet === board.me!.wallet)

  return (
    <div className="page active" id="page-leaderboard">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="page-header">
          <div className="page-title">Leaderboard</div>
          <div className="page-sub">
            {board ? `Season · ${monthLabel} · resets in ${board.days_left}d · ${board.total_players} players` : 'Season standings'}
          </div>
        </div>

        <div className="scroll">
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px 0', fontSize: 13 }}>Loading…</div>
          ) : !board || board.top.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px 0', fontSize: 13, lineHeight: 1.6 }}>
              No activity this season yet.<br />Earn ZXP by voting, checking in or winning Predict to climb the board.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 620 }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', lineHeight: 1.5, marginBottom: 4 }}>
                Ranked by ZXP earned this month. Top players win bonus ZXP &amp; a season badge when the month ends.
              </div>
              {board.top.map(row => {
                const isMe = address && row.wallet === address.toLowerCase()
                return (
                  <div key={row.wallet} style={{
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '9px 12px', borderRadius: 10,
                    background: isMe ? 'rgba(201,165,90,0.07)' : 'transparent',
                    border: `0.5px solid ${isMe ? 'rgba(201,165,90,0.3)' : 'var(--border)'}`,
                  }}>
                    <Medal rank={row.rank} />
                    <Link href={`/u/${row.wallet}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name ?? shortAddr(row.wallet)}{isMe ? ' · you' : ''}
                      </div>
                      {row.name && <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{shortAddr(row.wallet)}</div>}
                    </Link>
                    <div style={{ fontSize: 14, fontWeight: 700, color: rankColor(row.rank) }}>
                      {row.xp.toLocaleString()} <span style={{ fontSize: 10, color: 'var(--muted2)', fontWeight: 500 }}>XP</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky "your rank" if connected and outside the visible top */}
      {board?.me && !meInTop && (
        <div style={{
          position: 'sticky', bottom: 0, margin: '0 auto', maxWidth: 620, width: '100%',
          padding: '10px 12px', borderRadius: 12,
          background: 'rgba(201,165,90,0.1)', border: '0.5px solid rgba(201,165,90,0.3)',
          display: 'flex', alignItems: 'center', gap: 11,
        }}>
          <Medal rank={board.me.rank} />
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>You · {shortAddr(board.me.wallet)}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
            {board.me.xp.toLocaleString()} <span style={{ fontSize: 10, color: 'var(--muted2)', fontWeight: 500 }}>XP</span>
          </div>
        </div>
      )}
    </div>
  )
}
