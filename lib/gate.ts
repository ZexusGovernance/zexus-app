// ═══════════════════════════════════════════════════════════════
// Access gate — signed, httpOnly cookie proving a valid invite code
// was entered. Used by middleware.ts (Edge) and the verify API route
// (Node), so the HMAC is done with Web Crypto, which exists in both.
// The secret never leaves the server; only the HMAC is put in the cookie.
// ═══════════════════════════════════════════════════════════════

const SECRET =
  process.env.AUTH_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'zexus-dev-secret-change-me'

export const ACCESS_COOKIE = 'zx_access'
export const ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

const enc = new TextEncoder()

function bytesToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return bytesToB64url(mac)
}

/** Mint an access token: `access.<exp>.<hmac>` */
export async function createAccessToken(): Promise<string> {
  const exp = Date.now() + ACCESS_TTL_SECONDS * 1000
  const payload = `access.${exp}`
  return `${payload}.${await hmac(payload)}`
}

/** True only for an unexpired token whose signature matches our secret. */
export async function verifyAccessToken(
  token?: string | null,
): Promise<boolean> {
  if (!token) return false
  const i = token.lastIndexOf('.')
  if (i < 0) return false
  const payload = token.slice(0, i)
  const sig = token.slice(i + 1)
  if (!payload.startsWith('access.')) return false
  const exp = Number(payload.slice('access.'.length))
  if (!exp || Date.now() > exp) return false

  const expected = await hmac(payload)
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let k = 0; k < expected.length; k++) {
    diff |= expected.charCodeAt(k) ^ sig.charCodeAt(k)
  }
  return diff === 0
}
