'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'

const SUPER_ADMIN = (process.env.NEXT_PUBLIC_SUPER_ADMIN_WALLET ?? '').toLowerCase()

interface Project {
  id:           string
  name:         string
  slug:         string
  category:     string | null
  description:  string | null
  admin_wallet: string | null
  website_url:  string | null
  trust_score:  number
  is_verified:  boolean
  has_token:    boolean
  show_holders: boolean
  show_votes:   boolean
  avatar_url:   string | null
  created_at:   string
}

const EMPTY_FORM = {
  name: '', slug: '', category: '', description: '',
  admin_wallet: '', website_url: '', trust_score: 50, is_verified: false,
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function scoreColor(n: number) {
  if (n >= 70) return 'var(--green)'
  if (n >= 45) return 'var(--amber)'
  return 'var(--red)'
}

export default function AdminPage() {
  const { address, isConnected } = useAppKitAccount()
  const { open } = useAppKit()

  const [projects,    setProjects]    = useState<Project[]>([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [saveErr,     setSaveErr]     = useState<string | null>(null)
  const [editId,      setEditId]      = useState<string | null>(null)
  const [editScore,   setEditScore]   = useState<number>(50)
  const [editVerif,   setEditVerif]   = useState(false)
  const [editWallet,  setEditWallet]  = useState('')
  const [delConfirm,  setDelConfirm]  = useState<string | null>(null)

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
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Error')
    } finally { setSaving(false) }
  }

  async function saveEdit(id: string) {
    if (!address) return
    const r = await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, id, trust_score: editScore, is_verified: editVerif, admin_wallet: editWallet }),
    })
    if (r.ok) {
      setProjects(p => p.map(x => x.id === id ? { ...x, trust_score: editScore, is_verified: editVerif, admin_wallet: editWallet } : x))
      setEditId(null)
    }
  }

  async function deleteProject(id: string) {
    if (!address) return
    const r = await fetch(`/api/admin?id=${id}&wallet=${address}`, { method: 'DELETE' })
    if (r.ok) { setProjects(p => p.filter(x => x.id !== id)); setDelConfirm(null) }
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  // ── Not connected ──
  if (!isConnected || !address) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, background: 'var(--bg)' }}>
        <i className="ph-bold ph-shield-slash" style={{ fontSize: 40, color: 'var(--muted2)' }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Admin access</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 260, textAlign: 'center', lineHeight: 1.6 }}>Connect your admin wallet to access this page.</div>
        <button onClick={() => open()} style={{ padding: '9px 20px', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Connect Wallet
        </button>
      </div>
    )
  }

  // ── Wrong wallet ──
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, background: 'var(--bg)' }}>
        <i className="ph-bold ph-lock" style={{ fontSize: 40, color: 'var(--red)', opacity: 0.6 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Access denied</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{address.slice(0, 6)}…{address.slice(-4)}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>This wallet is not authorised.</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)', padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <a href="/" style={{ color: 'var(--muted2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
          <i className="ph-bold ph-arrow-left" style={{ fontSize: 11 }} /> App
        </a>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          <i className="ph-bold ph-shield-star" style={{ marginRight: 8, color: '#6f9be5' }} />Zexus Admin
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'monospace' }}>
          {address.slice(0, 6)}…{address.slice(-4)}
        </div>
        <div style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(111,155,229,0.12)', color: '#6f9be5', border: '0.5px solid rgba(111,155,229,0.25)', fontWeight: 600 }}>
          Super Admin
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total projects', value: projects.length, icon: 'ph-buildings' },
            { label: 'Verified', value: projects.filter(p => p.is_verified).length, icon: 'ph-shield-check', color: 'var(--green)' },
            { label: 'Avg Trust Score', value: projects.length ? Math.round(projects.reduce((s, p) => s + p.trust_score, 0) / projects.length) : '—', icon: 'ph-chart-line', color: '#6f9be5' },
          ].map(s => (
            <div key={s.label} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 8 }}>
                <i className={`ph-bold ${s.icon}`} style={{ marginRight: 5 }} />{s.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: (s as { color?: string }).color ?? 'var(--text)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <i className="ph-bold ph-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted2)', fontSize: 12 }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search projects…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 9, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setSaveErr(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: '0.5px solid rgba(111,155,229,0.35)', background: showForm ? 'rgba(111,155,229,0.15)' : 'rgba(111,155,229,0.08)', color: '#6f9be5', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >
            <i className={`ph-bold ${showForm ? 'ph-x' : 'ph-plus'}`} />
            {showForm ? 'Cancel' : 'Add Project'}
          </button>
          <button onClick={load} title="Refresh"
            style={{ padding: '8px 12px', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--muted2)', cursor: 'pointer', fontSize: 14 }}>
            <i className={`ph-bold ph-arrow-clockwise${loading ? ' spin' : ''}`} />
          </button>
        </div>

        {/* Add project form */}
        {showForm && (
          <div style={{ background: 'transparent', border: '0.5px solid rgba(111,155,229,0.2)', borderRadius: 14, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6f9be5', marginBottom: 16, letterSpacing: '1px', textTransform: 'uppercase' }}>
              <i className="ph-bold ph-plus-circle" style={{ marginRight: 6 }} />New Project
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'PROJECT NAME *', key: 'name', ph: 'AeroBase' },
                { label: 'SLUG *', key: 'slug', ph: 'aerobase' },
                { label: 'CATEGORY', key: 'category', ph: 'AMM, DEX, Lending…' },
                { label: 'ADMIN WALLET', key: 'admin_wallet', ph: '0x…' },
                { label: 'WEBSITE', key: 'website_url', ph: 'https://…' },
                { label: 'TRUST SCORE', key: 'trust_score', ph: '50', type: 'number' },
              ].map(({ label, key, ph, type }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px' }}>{label}</label>
                  <input
                    type={type ?? 'text'}
                    value={String(form[key as keyof typeof form])}
                    placeholder={ph}
                    onChange={e => {
                      const val = type === 'number' ? Number(e.target.value) : e.target.value
                      setForm(f => ({
                        ...f,
                        [key]: val,
                        ...(key === 'name' && f.slug === slugify(f.name) ? { slug: slugify(e.target.value) } : {}),
                      }))
                    }}
                    style={{ padding: '8px 11px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px' }}>DESCRIPTION</label>
              <textarea
                value={form.description} rows={2}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short project description…"
                style={{ padding: '8px 11px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
              />
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>
                <input type="checkbox" checked={form.is_verified} onChange={e => setForm(f => ({ ...f, is_verified: e.target.checked }))} />
                Verified project
              </label>
            </div>
            {saveErr && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)' }}><i className="ph-bold ph-warning-circle" style={{ marginRight: 5 }} />{saveErr}</div>}
            <button
              onClick={createProject} disabled={saving || !form.name.trim() || !form.slug.trim()}
              style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.07)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Creating…' : <><i className="ph-bold ph-plus" style={{ marginRight: 6 }} />Create Project</>}
            </button>
          </div>
        )}

        {/* Projects table */}
        {loading && !projects.length ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(p => (
              <div key={p.id} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <a href={`/projects/${p.slug}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#6f9be5')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}>
                        {p.name}
                      </a>
                      <span style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: 'monospace' }}>{p.slug}</span>
                      {p.is_verified && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, background: 'rgba(83,201,146,0.1)', color: 'var(--green)', border: '0.5px solid rgba(83,201,146,0.25)', fontWeight: 700 }}>VERIFIED</span>}
                      {p.category && <span style={{ fontSize: 10, color: 'var(--muted)', padding: '1px 6px', borderRadius: 5, border: '0.5px solid rgba(255,255,255,0.06)' }}>{p.category}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                      {p.admin_wallet
                        ? <><i className="ph-bold ph-wallet" style={{ marginRight: 4 }} />{p.admin_wallet.slice(0, 10)}…{p.admin_wallet.slice(-6)}</>
                        : <span style={{ opacity: 0.45 }}>No admin wallet</span>}
                    </div>
                  </div>
                  {/* Score */}
                  <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(p.trust_score), flexShrink: 0 }}>{p.trust_score}</div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => { setEditId(p.id); setEditScore(p.trust_score); setEditVerif(p.is_verified); setEditWallet(p.admin_wallet ?? '') }}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.09)', background: 'transparent', color: 'var(--muted2)', cursor: 'pointer', fontSize: 12 }}
                      title="Edit">
                      <i className="ph-bold ph-pencil" />
                    </button>
                    <button
                      onClick={() => setDelConfirm(p.id)}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '0.5px solid rgba(238,121,121,0.2)', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 12, opacity: 0.7 }}
                      title="Delete">
                      <i className="ph-bold ph-trash" />
                    </button>
                  </div>
                </div>

                {/* Inline edit */}
                {editId === p.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px' }}>TRUST SCORE</label>
                      <input type="number" min={0} max={100} value={editScore} onChange={e => setEditScore(Number(e.target.value))}
                        style={{ width: 80, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 7, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.8px' }}>ADMIN WALLET</label>
                      <input value={editWallet} onChange={e => setEditWallet(e.target.value)} placeholder="0x…"
                        style={{ width: 260, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: 7, color: 'var(--text)', fontSize: 12, fontFamily: 'monospace', outline: 'none' }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', paddingBottom: 7 }}>
                      <input type="checkbox" checked={editVerif} onChange={e => setEditVerif(e.target.checked)} /> Verified
                    </label>
                    <button onClick={() => saveEdit(p.id)}
                      style={{ padding: '6px 14px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Save
                    </button>
                    <button onClick={() => setEditId(null)}
                      style={{ padding: '6px 12px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.07)', background: 'transparent', color: 'var(--muted2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                  </div>
                )}

                {/* Delete confirm */}
                {delConfirm === p.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(238,121,121,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--red)' }}>Delete <strong>{p.name}</strong>? This cannot be undone.</span>
                    <button onClick={() => deleteProject(p.id)}
                      style={{ padding: '5px 14px', borderRadius: 7, border: '0.5px solid rgba(238,121,121,0.4)', background: 'rgba(238,121,121,0.1)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Delete
                    </button>
                    <button onClick={() => setDelConfirm(null)}
                      style={{ padding: '5px 12px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.07)', background: 'transparent', color: 'var(--muted2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
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
