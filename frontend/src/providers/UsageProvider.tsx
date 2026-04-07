'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from '@/providers/AuthProvider'

export interface UsageEntry {
  used: number
  limit: number
  remaining: number
  periodType?: 'daily' | 'monthly'
  resetAt?: string
}

export interface UsageStatus {
  tier: 'anonymous' | 'free' | 'premium'
  usage: Record<string, UsageEntry>
  credits?: { balance: number; canBuyMore?: boolean }
  subscription?: { status: string; periodEnd: string | null }
}

interface UsageContextValue {
  usage: UsageStatus | null
  refreshUsage: () => Promise<UsageStatus | null>
}

const UsageContext = createContext<UsageContextValue | null>(null)

export function UsageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [usage, setUsage] = useState<UsageStatus | null>(null)
  const isFetchingRef = useRef(false)

  const refreshUsage = useCallback(async (): Promise<UsageStatus | null> => {
    // Deduplicate: skip if a fetch is already in flight
    if (isFetchingRef.current) return null
    isFetchingRef.current = true
    try {
      const res = await fetch('/api/usage/status')
      if (!res.ok) return null
      const data: UsageStatus = await res.json()
      setUsage(data)
      return data
    } catch (_e) {
      return null
    } finally {
      isFetchingRef.current = false
    }
  }, []) // stable reference — no state deps

  useEffect(() => {
    refreshUsage()

    // Authenticated: refresh every 60s. Guest: every 30s.
    const interval = setInterval(refreshUsage, user ? 60_000 : 30_000)
    return () => clearInterval(interval)
  }, [user, refreshUsage])

  return (
    <UsageContext.Provider value={{ usage, refreshUsage }}>
      {children}
    </UsageContext.Provider>
  )
}

export function useUsage(): UsageContextValue {
  const ctx = useContext(UsageContext)
  if (!ctx) throw new Error('useUsage must be used within UsageProvider')
  return ctx
}
