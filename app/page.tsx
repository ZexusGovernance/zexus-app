'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const qs = typeof window !== 'undefined' ? window.location.search : ''
    router.replace(`/feed${qs}`)
  }, [router])
  return null
}
