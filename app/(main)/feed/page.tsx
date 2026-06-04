'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FeedPage from '@/components/feed/FeedPage'
import { useAppShell } from '@/lib/appShell'

function FeedRoute() {
  const router = useRouter()
  const params = useSearchParams()
  const { address, isProjectAdmin, adminProject, composeOpen, openCompose, closeCompose } = useAppShell()

  return (
    <FeedPage
      onNavigate={(page) => router.push(`/${page}`)}
      initialPostId={params.get('post')}
      composeOpen={composeOpen}
      onComposeOpen={openCompose}
      onComposeClose={closeCompose}
      isProjectAdmin={isProjectAdmin}
      adminProject={adminProject}
      walletAddress={address}
    />
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FeedRoute />
    </Suspense>
  )
}
