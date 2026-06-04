import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Never let browsers cache the HTML document, so a new deploy's content-hashed
// JS/CSS bundles are always picked up on the next load. This prevents stale UI
// (especially on mobile) after a deploy. Hashed assets under /_next/static stay
// immutable-cached, and only top-level document navigations are affected.
export function proxy(req: NextRequest) {
  const res = NextResponse.next()
  if (req.headers.get('sec-fetch-dest') === 'document') {
    res.headers.set('Cache-Control', 'no-store, must-revalidate')
  }
  return res
}

export const config = {
  // Skip static assets and image optimizer; everything else passes through.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
