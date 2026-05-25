'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Profile } from './profile'

interface ProfileContextValue {
  profile: Profile | null
  setProfile: (p: Profile | null) => void
  refreshProfile: (walletAddress: string) => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  setProfile: () => {},
  refreshProfile: async () => {},
})

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)

  const refreshProfile = useCallback(async (walletAddress: string) => {
    const { getProfileWithRank } = await import('./profile')
    const p = await getProfileWithRank(walletAddress)
    setProfile(p)
  }, [])

  return (
    <ProfileContext.Provider value={{ profile, setProfile, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
