'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Notif {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
  post_id?: string
}

export function useNotifs(address: string | undefined) {
  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [unread,  setUnread]  = useState(0)
  const [loaded,  setLoaded]  = useState(false)

  const load = useCallback(async () => {
    if (!address) return
    try {
      const res  = await fetch(`/api/notifications?wallet=${address}`)
      const data = await res.json()
      setNotifs(data.notifications ?? [])
      setUnread(data.unread_count ?? 0)
      setLoaded(true)
    } catch { /* ignore */ }
  }, [address])

  useEffect(() => {
    if (!address) { setUnread(0); setNotifs([]); setLoaded(false); return }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [address, load])

  async function markAll() {
    if (!address) return
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, mark_all: true }),
    })
    setNotifs(n => n.map(x => ({ ...x, is_read: true })))
    setUnread(0)
  }

  async function markOne(id: string) {
    if (!address) return
    setNotifs(n => n.map(x => (x.id === id ? { ...x, is_read: true } : x)))
    setUnread(u => Math.max(0, u - 1))
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, notification_id: id }),
    })
  }

  return { notifs, unread, loaded, load, markAll, markOne }
}
