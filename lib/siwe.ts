import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

// ═══════════════════════════════════════════════════════════════
// SIWE (Sign-In With Ethereum) — nonce + HMAC session tokens
// No external deps: uses node:crypto for signing, viem for verify.
// ═══════════════════════════════════════════════════════════════

const SECRET =
  process.env.AUTH_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'zexus-dev-secret-change-me'

export const SESSION_COOKIE = 'zx_session'
export const NONCE_COOKIE = 'zx_nonce'

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days
export const NONCE_TTL_SECONDS = 10 * 60 // 10 minutes

const DOMAIN = 'app.zexus.xyz'

// ── base64url helpers ──────────────────────────────────────────
function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function hmac(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

// ── Nonce ──────────────────────────────────────────────────────
export function generateNonce(): string {
  return randomBytes(16).toString('hex')
}

/** Signed nonce cookie value: `nonce.exp.hmac` */
export function packNonce(nonce: string): string {
  const exp = Date.now() + NONCE_TTL_SECONDS * 1000
  const payload = `${nonce}.${exp}`
  return `${payload}.${hmac(payload)}`
}

export function verifyNonceCookie(value: string | undefined, nonce: string): boolean {
  if (!value) return false
  const parts = value.split('.')
  if (parts.length !== 3) return false
  const [cookieNonce, expStr, sig] = parts
  if (!safeEqual(hmac(`${cookieNonce}.${expStr}`), sig)) return false
  if (Date.now() > Number(expStr)) return false
  return safeEqual(cookieNonce, nonce)
}

// ── SIWE message ───────────────────────────────────────────────
export function buildSiweMessage(address: string, nonce: string): string {
  return [
    `${DOMAIN} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to Zexus. This request will not trigger a blockchain transaction or cost any gas fees.',
    '',
    `Nonce: ${nonce}`,
  ].join('\n')
}

/** Extract the nonce embedded in a signed message (defensive parse). */
export function extractNonce(message: string): string | null {
  const m = message.match(/Nonce:\s*([0-9a-f]+)/i)
  return m ? m[1] : null
}

// ── Session token ──────────────────────────────────────────────
/** Session token: `base64url({addr,exp}).hmac` */
export function createSession(address: string): string {
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000
  const payload = b64url(JSON.stringify({ addr: address.toLowerCase(), exp }))
  return `${payload}.${hmac(payload)}`
}

export function verifySession(token: string | undefined): string | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!safeEqual(hmac(payload), sig)) return null
  try {
    const { addr, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof addr !== 'string' || typeof exp !== 'number') return null
    if (Date.now() > exp) return null
    return addr.toLowerCase()
  } catch {
    return null
  }
}
