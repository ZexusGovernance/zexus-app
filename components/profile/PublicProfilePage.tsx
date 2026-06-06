'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Avatar from 'boring-avatars'

const AVATAR_COLORS = ['#0a0a0f', '#3b82f6', '#a855f7', '#22d3ee', '#65bf7f']

interface PublicProfile {
  wallet:        string
  display_name:  string | null
  avatar_url:    string | null
  public:        boolean
  zxp_balance?:  number
  rank?:         number
  registered_at?: string | null
  verdicts?:     number
  finalized?:    number
  accuracy?:     number | null
}

function shortAddr(w: string) {
  return `${w.slice(0, 6)}…${w.slice(-4)}`
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  )
}

export default function PublicProfilePage({ wallet }: { wallet: string }) {
  const router = useRouter()
  const [data, setData]       = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/users/${encodeURIComponent(wallet)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.profile) setData(d.profile); else setNotFound(true) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [wallet])

  const name = data?.display_name ?? shortAddr(wallet)

  return (
    <div className="page active" id="page-public-profile">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="page-header">
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="ph-bold ph-arrow-left" /> Back
          </button>
          <div className="page-title">Profile</div>
        </div>

        <div className="scroll">
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px 0', fontSize: 13 }}>Loading…</div>
          ) : notFound || !data ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px 0', fontSize: 13 }}>
              This user hasn&rsquo;t joined Zexus yet.
            </div>
          ) : (
            <div style={{ maxWidth: 560 }}>
              {/* Identity card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, border: '0.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>
                  {data.avatar_url
                    ? <img src={data.avatar_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover' }} />
                    : <Avatar size={56} name={wallet.toLowerCase()} variant="marble" colors={AVATAR_COLORS} square />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted2)', fontFamily: 'monospace' }}>{shortAddr(wallet)}</div>
                </div>
              </div>

              {data.public ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <Stat label="ZXP" value={Math.floor(data.zxp_balance ?? 0).toLocaleString()} color="var(--gold)" />
                    <Stat label="Global rank" value={data.rank ? `#${data.rank}` : '—'} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Stat label="Verdicts cast" value={String(data.verdicts ?? 0)} />
                    <Stat
                      label="Accuracy"
                      value={data.accuracy != null ? `${data.accuracy}%` : '—'}
                      color={data.accuracy != null && data.accuracy >= 60 ? 'var(--green)' : undefined}
                    />
                  </div>
                  {!data.finalized ? (
                    <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 10, lineHeight: 1.5 }}>
                      Accuracy appears once this user has votes on finalized verdicts.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 10, lineHeight: 1.5 }}>
                      Based on {data.finalized} finalized verdict{data.finalized === 1 ? '' : 's'}.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 13, border: '0.5px solid var(--border)', borderRadius: 12, lineHeight: 1.6 }}>
                  <i className="ph-bold ph-lock-simple" style={{ fontSize: 20, display: 'block', marginBottom: 8, opacity: 0.5 }} />
                  This profile is private.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="right"></div>
    </div>
  )
}
