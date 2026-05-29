import { NextRequest, NextResponse } from 'next/server'
import {
  generateNonce,
  packNonce,
  buildSiweMessage,
  NONCE_COOKIE,
  NONCE_TTL_SECONDS,
} from '@/lib/siwe'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// GET /api/auth/nonce?address=0x... — issues a fresh nonce and stores a
// signed copy in an httpOnly cookie. When an address is supplied, also
// returns the canonical message the client should sign.
export async function GET(req: NextRequest) {
  const nonce = generateNonce()
  const address = req.nextUrl.searchParams.get('address')?.toLowerCase().trim()

  const payload: { nonce: string; message?: string } = { nonce }
  if (address && WALLET_RE.test(address)) {
    payload.message = buildSiweMessage(address, nonce)
  }

  const res = NextResponse.json(payload)
  res.cookies.set(NONCE_COOKIE, packNonce(nonce), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: NONCE_TTL_SECONDS,
  })
  return res
}
