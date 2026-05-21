import { NextRequest, NextResponse } from 'next/server'
import { setWebhook } from '@/lib/telegram'

const ADMIN = (process.env.SUPER_ADMIN_WALLET ?? '').toLowerCase()

// GET /api/telegram/setup-webhook?wallet=0x...
// Run once after deploy to register the webhook URL with Telegram
export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get('wallet') ?? '').toLowerCase()
  if (!wallet || wallet !== ADMIN)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.zexus.xyz'
  const result  = await setWebhook(`${siteUrl}/api/telegram/webhook`)
  return NextResponse.json(result)
}
