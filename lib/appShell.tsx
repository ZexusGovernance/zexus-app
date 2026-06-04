'use client'

import { createContext, useContext } from 'react'

export interface AppShellValue {
  address?:        string
  userRole:        'user' | 'project'
  adminProject:    { name: string; slug?: string } | null
  isProjectAdmin:  boolean
  composeOpen:     boolean
  openCompose:     () => void
  closeCompose:    () => void
}

export const AppShellContext = createContext<AppShellValue | null>(null)

export function useAppShell(): AppShellValue {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error('useAppShell must be used inside the (main) layout')
  return ctx
}
