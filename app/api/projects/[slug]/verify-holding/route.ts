import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/
const BASE_RPC  = process.env.BASE_RPC_URL ?? ''

// ERC-20 function selectors
const SEL_BALANCE_OF = '0x70a08231'
const SEL_DECIMALS   = '0x313ce567'

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
  })
  const json = await res.json()
  return (json.result as string) ?? '0x0'
}

function formatBalance(raw: bigint, decimals: number): string {
  if (raw === 0n) return '0'
  const divisor = 10n ** BigInt(decimals)
  const whole   = raw / divisor
  const frac    = raw % divisor
  if (frac === 0n) return whole.toLocaleString()
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 4)
  return `${whole.toLocaleString()}.${fracStr}`
}

// POST /api/projects/[slug]/verify-holding  body: { wallet }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  let wallet: string
  try {
    const body = await req.json()
    wallet = (body.wallet as string)?.toLowerCase().trim() ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!WALLET_RE.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, token_address, has_token')
    .eq('slug', slug)
    .maybeSingle()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const tokenAddr = (project.token_address as string | null)?.trim()
  if (!tokenAddr || !project.has_token) {
    return NextResponse.json({ error: 'This project has no token configured' }, { status: 400 })
  }

  if (!BASE_RPC) {
    return NextResponse.json({ error: 'RPC not configured' }, { status: 503 })
  }

  // Parallel: balanceOf + decimals
  const paddedWallet = '000000000000000000000000' + wallet.slice(2)
  const [balHex, decHex] = await Promise.all([
    ethCall(tokenAddr, SEL_BALANCE_OF + paddedWallet),
    ethCall(tokenAddr, SEL_DECIMALS),
  ])

  let balanceRaw: bigint
  let decimals: number
  try {
    balanceRaw = BigInt(balHex)
    decimals   = Number(BigInt(decHex || '0x12'))
    if (decimals > 18) decimals = 18
  } catch {
    return NextResponse.json({ error: 'Failed to read token data from chain' }, { status: 502 })
  }

  const holds   = balanceRaw > 0n
  const formatted = formatBalance(balanceRaw, decimals)

  if (holds) {
    await supabaseAdmin.from('token_holders').upsert(
      {
        project_id:     project.id,
        wallet_address: wallet,
        verified_at:    new Date().toISOString(),
        balance_raw:    balanceRaw.toString(),
      },
      { onConflict: 'project_id,wallet_address' },
    )
  }

  return NextResponse.json({ holds, balance: formatted, balance_raw: balanceRaw.toString() })
}
