'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'zexus_access'

export default function InviteGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setVerified(localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  async function submit() {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/invite/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const d = await r.json() as { valid: boolean }
      if (d.valid) {
        localStorage.setItem(STORAGE_KEY, '1')
        setVerified(true)
      } else {
        setError('Invalid code')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (verified === null) return null
  if (verified) return <>{children}</>

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0b0a09',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 340,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '4px',
            color: '#c9a55a',
            marginBottom: 8,
          }}>
            ZEXUS
          </div>
          <div style={{ fontSize: 13, color: '#666', letterSpacing: '0.5px' }}>
            Early Access
          </div>
        </div>

        {/* Card */}
        <div style={{
          width: '100%',
          background: '#13120f',
          border: '0.5px solid rgba(201,165,90,0.15)',
          borderRadius: 16,
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, textAlign: 'center' }}>
            Platform is in early access.<br />Enter your invite code to continue.
          </div>

          <input
            type="text"
            placeholder="Invite code"
            value={code}
            onChange={e => { setCode(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
            style={{
              background: '#0b0a09',
              border: `0.5px solid ${error ? '#e07070' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              color: '#e8e3dc',
              outline: 'none',
              textAlign: 'center',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          {error && (
            <div style={{ fontSize: 12, color: '#e07070', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !code.trim()}
            style={{
              background: code.trim() ? '#c9a55a' : 'rgba(201,165,90,0.2)',
              color: code.trim() ? '#0b0a09' : '#666',
              border: 'none',
              borderRadius: 10,
              padding: '12px',
              fontSize: 14,
              fontWeight: 600,
              cursor: code.trim() ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            {loading ? '...' : 'Enter'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: '#444', textAlign: 'center' }}>
          DeFi Trust Layer on Base Mainnet
        </div>
      </div>
    </div>
  )
}
