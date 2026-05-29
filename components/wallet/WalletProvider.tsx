'use client'

import { wagmiAdapter } from '@/lib/walletConfig'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ProfileProvider, useProfile } from '@/lib/profileContext'
import { useAppKitAccount } from '@reown/appkit/react'
import { useEffect, useRef } from 'react'
import { useSiwe } from '@/lib/useSiwe'

import '@/lib/walletConfig'

const queryClient = new QueryClient()

function WalletWatcher() {
  const { address, isConnected } = useAppKitAccount()
  const { refreshProfile } = useProfile()
  const { signIn } = useSiwe()
  const lastAddress = useRef<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address) return
    if (lastAddress.current === address) return
    lastAddress.current = address

    async function init() {
      // Establish a verified session (prompts a gas-free signature once).
      await signIn(address!)
      const { upsertProfile } = await import('@/lib/profile')
      await upsertProfile(address!)
      await refreshProfile(address!)
    }
    init()
  }, [isConnected, address, refreshProfile, signIn])

  return null
}

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ProfileProvider>
          <WalletWatcher />
          {children}
        </ProfileProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
