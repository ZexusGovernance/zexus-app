import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/siwe'

// ═══════════════════════════════════════════════════════════════
// Server-side auth helpers for API routes.
// requireAuth() returns the verified, lowercased wallet address of
// the signed-in user — or null if no valid session cookie is present.
// ═══════════════════════════════════════════════════════════════

export function getSessionAddress(req: NextRequest): string | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  return verifySession(token)
}

/** Returns the verified wallet address, or null. */
export function requireAuth(req: NextRequest): string | null {
  return getSessionAddress(req)
}

/** Standard 401 response. */
export function unauthorized(message = 'Unauthorized — please sign in with your wallet') {
  return NextResponse.json({ error: message }, { status: 401 })
}

const SUPER_ADMIN = (process.env.SUPER_ADMIN_WALLET ?? '').toLowerCase()

/** True if the given verified address is the configured super admin. */
export function isSuperAdmin(address: string | null): boolean {
  return !!address && !!SUPER_ADMIN && address.toLowerCase() === SUPER_ADMIN
}
