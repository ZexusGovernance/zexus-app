import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
import {
  SESSION_COOKIE,
  NONCE_COOKIE,
  SESSION_TTL_SECONDS,
  createSession,
  verifyNonceCookie,
  extractNonce,
  buildSiweMessage,
} from '@/lib/siwe'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

// POST /api/auth/verify { address, signature }
// Verifies the wallet signature over the canonical SIWE message
// (rebuilt server-side from the nonce cookie) and, on success, issues
// a session cookie.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const address = (body.address as string)?.toLowerCase().trim()
  const signature = body.signature as string

  if (!address || !WALLET_RE.test(address)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }
  if (!signature || typeof signature !== 'string') {
    return NextResponse.json({ error: 'signature is required' }, { status: 400 })
  }

  // The client may send the exact message it signed; otherwise we
  // reconstruct it. Either way the nonce must match the cookie.
  const cookieNonceRaw = req.cookies.get(NONCE_COOKIE)?.value
  const clientMessage = typeof body.message === 'string' ? (body.message as string) : null
  const nonce = clientMessage ? extractNonce(clientMessage) : extractNonceFromCookie(cookieNonceRaw)

  if (!nonce || !verifyNonceCookie(cookieNonceRaw, nonce)) {
    return NextResponse.json({ error: 'Invalid or expired nonce — request a new one' }, { status: 401 })
  }

  // Always verify against the canonical message we control.
  const message = buildSiweMessage(address, nonce)

  let valid = false
  try {
    valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    valid = false
  }

  if (!valid) {
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
  }

  // Register/refresh profile (idempotent).
  await supabaseAdmin
    .from('profiles')
    .upsert({ wallet_address: address }, { onConflict: 'wallet_address', ignoreDuplicates: true })

  const res = NextResponse.json({ ok: true, address })
  res.cookies.set(SESSION_COOKIE, createSession(address), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  // Clear the consumed nonce.
  res.cookies.set(NONCE_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}

// The nonce cookie is `nonce.exp.hmac`; pull the raw nonce out for the
// case where the client did not echo the message back.
function extractNonceFromCookie(value: string | undefined): string | null {
  if (!value) return null
  const parts = value.split('.')
  return parts.length === 3 ? parts[0] : null
}
