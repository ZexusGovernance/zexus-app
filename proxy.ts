import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ACCESS_COOKIE, verifyAccessToken } from '@/lib/gate'

// Paths reachable without a valid access cookie: the locked screen itself
// and the endpoint that validates the invite code (which sets the cookie).
const PUBLIC = ['/locked', '/api/invite/verify']

function isPublic(pathname: string): boolean {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// Never let browsers cache the HTML document, so a new deploy's content-hashed
// JS/CSS bundles are always picked up on the next load. This prevents stale UI
// (especially on mobile) after a deploy. Hashed assets under /_next/static stay
// immutable-cached, and only top-level document navigations are affected.
function withNoStore(req: NextRequest, res: NextResponse): NextResponse {
  if (req.headers.get('sec-fetch-dest') === 'document') {
    res.headers.set('Cache-Control', 'no-store, must-revalidate')
  }
  return res
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Access gate: test phase is over, only valid invite code gets in ──
  if (!isPublic(pathname)) {
    const ok = await verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value)
    if (!ok) {
      // Block APIs hard; send page requests to the locked screen.
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Locked — the test phase has ended' },
          { status: 403 },
        )
      }
      const url = req.nextUrl.clone()
      url.pathname = '/locked'
      url.search = ''
      return withNoStore(req, NextResponse.rewrite(url))
    }
  }

  return withNoStore(req, NextResponse.next())
}

export const config = {
  // Skip static assets and image optimizer; everything else passes through.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
