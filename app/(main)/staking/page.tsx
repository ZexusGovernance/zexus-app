'use client'

import { Suspense } from 'react'
import StakingPage from '@/components/staking/StakingPage'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StakingPage />
    </Suspense>
  )
}
