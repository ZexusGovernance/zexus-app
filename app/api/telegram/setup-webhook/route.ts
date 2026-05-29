import { NextRequest, NextResponse } from 'next/server'
import { setWebhook } from '@/lib/telegram'
import { requireAuth, isSuperAdmin } from '@/lib/auth'

// GET /api/telegram/setup-webhook
// Run once after deploy to register the webhook URL with Telegram (super-admin).
export async function GET(req: NextRequest) {
  if (!isSuperAdmin(requireAuth(req)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.zexus.xyz'
  const result  = await setWebhook(`${siteUrl}/api/telegram/webhook`)
  return NextResponse.json(result)
}
