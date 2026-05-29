'use client'

import { useCallback, useRef, useState } from 'react'
import { useSignMessage } from 'wagmi'

// ═══════════════════════════════════════════════════════════════
// Client hook that performs the SIWE handshake:
//   1. check existing session (/api/auth/me)
//   2. fetch nonce + canonical message (/api/auth/nonce)
//   3. sign the message with the wallet (no gas)
//   4. exchange the signature for a session cookie (/api/auth/verify)
// ═══════════════════════════════════════════════════════════════

export type SiweStatus = 'idle' | 'signing' | 'authed' | 'error'

export function useSiwe() {
  const { signMessageAsync } = useSignMessage()
  const [status, setStatus] = useState<SiweStatus>('idle')
  const inFlight = useRef(false)

  /** Returns true if a valid session exists for `address`. */
  const checkSession = useCallback(async (address: string): Promise<boolean> => {
    try {
      const me = await fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json())
      return typeof me?.address === 'string' && me.address.toLowerCase() === address.toLowerCase()
    } catch {
      return false
    }
  }, [])

  /** Ensure the user has a session, prompting for a signature if needed. */
  const signIn = useCallback(
    async (address: string): Promise<boolean> => {
      if (inFlight.current) return false
      inFlight.current = true
      try {
        if (await checkSession(address)) {
          setStatus('authed')
          return true
        }

        setStatus('signing')

        const { message } = await fetch(`/api/auth/nonce?address=${address}`, {
          cache: 'no-store',
        }).then(r => r.json())

        if (!message) {
          setStatus('error')
          return false
        }

        const signature = await signMessageAsync({ message })

        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, signature, message }),
        })

        if (!res.ok) {
          setStatus('error')
          return false
        }

        setStatus('authed')
        return true
      } catch {
        setStatus('error')
        return false
      } finally {
        inFlight.current = false
      }
    },
    [checkSession, signMessageAsync],
  )

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setStatus('idle')
  }, [])

  return { status, signIn, signOut, checkSession }
}
