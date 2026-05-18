# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Warning: Next.js 16

This project uses **Next.js 16.2.6** — a version with breaking changes relative to earlier releases. APIs, conventions, and file structure may differ from training data. Before writing Next.js-specific code, consult the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

## Commands

```bash
npm run dev      # Start dev server (uses --webpack flag explicitly)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test suite is configured.

## Architecture

The Next.js App Router layer (`/app`) is intentionally thin — it exists only to serve metadata and host a full-screen iframe.

**`/app/page.tsx`** — Renders a single `<iframe src="/index.html">` that fills the viewport.

**`/public/index.html`** — The actual application UI (~200KB standalone HTML file). All feature logic (voting, Trust Scores, Emergency Calls, ZXP staking, WalletConnect) lives here, not in the Next.js layer.

**`/app/layout.tsx`** — Root layout setting Open Graph / Twitter metadata and dark background. `NEXT_PUBLIC_SITE_URL` env var sets the canonical URL (defaults to `https://app.zexus.xyz`).

When making UI or feature changes, the work is almost always in `/public/index.html`, not in the Next.js routes.

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for metadata |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID |
| `BASE_RPC_URL` | Alchemy RPC endpoint for Base Mainnet |
| `WAITLIST_CONTRACT_ADDRESS` | On-chain waitlist contract address |
| `RELAYER_PRIVATE_KEY` | Private key used by the relayer for contract calls |

## Code Style

Enforced by Prettier (`.prettierrc`):
- No semicolons
- Single quotes
- Trailing commas everywhere (`"all"`)
- 80-character print width

TypeScript strict mode is enabled. Path alias `@/*` resolves to the repo root.
