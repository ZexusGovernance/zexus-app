import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { base } from '@reown/appkit/networks'
import { createAppKit } from '@reown/appkit/react'
import type { AppKitNetwork } from '@reown/appkit-common'

export const projectId = 'cafd0501cf9af168e43a539088ac45aa'

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [base]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
})

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'Zexus',
    description: 'Zexus Governance — Trust Scores, Voting, ZXP Staking on Base Mainnet',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://app.zexus.xyz',
    icons: [],
  },
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-color-mix': '#c9a55a',
    '--w3m-color-mix-strength': 20,
    '--w3m-accent': '#c9a55a',
    '--w3m-border-radius-master': '6px',
  },
})
