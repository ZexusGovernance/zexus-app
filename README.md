# Zexus Governance

Zexus is a Web3 governance and community intelligence app for crypto projects. It combines project profiles, token-holder verification, community voting, ZXP reputation mechanics, prediction markets, staking, alerts, and admin analytics in one public-facing dApp.

Live app: https://zexus-app.vercel.app

## What It Does

- Project profiles with trust score, roadmap, posts, holder data, and social links
- Community voting that feeds into project trust and reputation signals
- ZXP staking, burn, rewards, milestones, achievements, and profile badges
- Prediction markets for community sentiment and project outcomes
- Emergency Call flows for project/community escalation
- Admin dashboard for project scoring, invites, analytics, and market creation
- Telegram notifications for important wallet and project events
- Mobile-first interface with wallet connection and app-style navigation

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Supabase
- Wagmi, Viem, Reown AppKit
- Vercel

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Environment

The app expects project-specific environment variables for Supabase, wallet integrations, Telegram, email, and deployment cron routes. Production values are managed outside the repository.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Status

Zexus is in active development. The current public repository is a clean application snapshot intended for project demos, product review, and ongoing iteration.
