import { NextRequest, NextResponse } from 'next/server'

const ADMIN = (process.env.SUPER_ADMIN_WALLET ?? '').toLowerCase()

export async function GET(req: NextRequest) {
  const wallet   = (req.nextUrl.searchParams.get('wallet') ?? '').toLowerCase()
  const github   = req.nextUrl.searchParams.get('github') ?? ''
  const contract = req.nextUrl.searchParams.get('contract') ?? ''

  if (!wallet || wallet !== ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result: Record<string, unknown> = {}

  // ── GitHub ──────────────────────────────────────────────────────────────────
  if (github) {
    try {
      const match = github.match(/github\.com\/([^/]+)\/([^/?#]+)/)
      if (match) {
        const [, owner, repo] = match
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

        const commitsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&per_page=1`,
          { headers: { 'User-Agent': 'ZexusAdmin/1.0', Accept: 'application/vnd.github.v3+json' } },
        )
        if (commitsRes.ok) {
          const link = commitsRes.headers.get('link') ?? ''
          const lastMatch = link.match(/page=(\d+)>; rel="last"/)
          if (lastMatch) {
            result.github_commits_30d = parseInt(lastMatch[1])
          } else {
            const data = await commitsRes.json()
            result.github_commits_30d = Array.isArray(data) ? data.length : 0
          }
        } else {
          result.github_commits_30d = 0
        }

        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'User-Agent': 'ZexusAdmin/1.0' },
        })
        if (repoRes.ok) {
          const rd = await repoRes.json()
          result.github_stars     = rd.stargazers_count
          result.github_last_push = rd.pushed_at
        }
      }
    } catch (e) {
      result.github_error = String(e)
    }
  }

  // ── BaseScan ─────────────────────────────────────────────────────────────────
  if (contract && process.env.BASESCAN_API_KEY) {
    const key = process.env.BASESCAN_API_KEY
    try {
      // Token holder count (ERC-20)
      const holdRes = await fetch(
        `https://api.basescan.org/api?module=token&action=tokenholdercount&contractaddress=${contract}&apikey=${key}`,
      )
      const holdData = await holdRes.json()
      if (holdData.status === '1' && holdData.result) {
        result.onchain_wallets = parseInt(holdData.result)
      } else {
        // Fallback: unique tx senders (first 10k)
        const txRes = await fetch(
          `https://api.basescan.org/api?module=account&action=txlist&address=${contract}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${key}`,
        )
        const txData = await txRes.json()
        if (txData.status === '1' && Array.isArray(txData.result)) {
          const unique = new Set<string>(
            (txData.result as { from: string }[]).map(tx => tx.from.toLowerCase()),
          )
          result.onchain_wallets = unique.size
          if (txData.result.length > 0) {
            const firstTs = parseInt((txData.result[0] as { timeStamp: string }).timeStamp)
            result.contract_age_months = Math.floor(
              (Date.now() - firstTs * 1000) / (30 * 24 * 60 * 60 * 1000),
            )
          }
        }
      }

      // Contract creation block → age
      const creationRes = await fetch(
        `https://api.basescan.org/api?module=contract&action=getcontractcreation&contractaddresses=${contract}&apikey=${key}`,
      )
      const creationData = await creationRes.json()
      if (creationData.status === '1' && creationData.result?.[0]?.txHash) {
        const txHash = (creationData.result[0] as { txHash: string }).txHash
        const txRes2 = await fetch(
          `https://api.basescan.org/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${key}`,
        )
        const txData2 = await txRes2.json()
        const blockHex = txData2?.result?.blockNumber
        if (blockHex) {
          const blockRes = await fetch(
            `https://api.basescan.org/api?module=block&action=getblockreward&blockno=${parseInt(blockHex, 16)}&apikey=${key}`,
          )
          const blockData = await blockRes.json()
          if (blockData.status === '1' && blockData.result?.timeStamp) {
            result.contract_age_months = Math.floor(
              (Date.now() - parseInt(blockData.result.timeStamp) * 1000) / (30 * 24 * 60 * 60 * 1000),
            )
          }
        }
      }
    } catch (e) {
      result.basescan_error = String(e)
    }
  }

  return NextResponse.json(result)
}
