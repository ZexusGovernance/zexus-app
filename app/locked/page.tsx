'use client'

import { useState } from 'react'

export default function LockedPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      const d = (await r.json()) as { valid: boolean; expired?: boolean }
      if (d.valid) {
        // Full navigation so middleware re-evaluates with the new cookie.
        window.location.href = '/feed'
      } else {
        setError(d.expired ? 'Code expired' : 'Invalid code')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0b0a09',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '4px',
              color: '#c9a55a',
              marginBottom: 8,
            }}
          >
            ZEXUS
          </div>
          <div style={{ fontSize: 13, color: '#666', letterSpacing: '0.5px' }}>
            DeFi Trust Layer on Base Mainnet
          </div>
        </div>

        {/* Message card */}
        <div
          style={{
            width: '100%',
            background: '#13120f',
            border: '0.5px solid rgba(201,165,90,0.15)',
            borderRadius: 16,
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: '#e8e3dc' }}>
            The test phase is over
          </div>
          <div style={{ fontSize: 13, color: '#999', lineHeight: 1.7 }}>
            Please await updates on X
          </div>
          <a
            href="https://x.com/ZexusGovernance"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 10,
              background: '#c9a55a',
              color: '#0b0a09',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            @ZexusGovernance →
          </a>
        </div>

        {/* Access code (admins only) */}
        <details style={{ width: '100%' }}>
          <summary
            style={{
              fontSize: 12,
              color: '#555',
              textAlign: 'center',
              cursor: 'pointer',
              listStyle: 'none',
              userSelect: 'none',
            }}
          >
            Have an access code?
          </summary>
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <input
              type="text"
              placeholder="Access code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              style={{
                background: '#0b0a09',
                border: `0.5px solid ${
                  error ? '#e07070' : 'rgba(255,255,255,0.1)'
                }`,
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
              <div
                style={{ fontSize: 12, color: '#e07070', textAlign: 'center' }}
              >
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
        </details>
      </div>
    </div>
  )
}
