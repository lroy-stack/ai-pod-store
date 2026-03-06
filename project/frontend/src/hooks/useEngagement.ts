'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'

export interface UsageStatus {
  tier: 'anonymous' | 'free' | 'premium'
  usage: Record<string, { used: number; limit: number; remaining: number }>
  credits?: { balance: number; canBuyMore: boolean }
  subscription?: { status: string; periodEnd: string | null }
}

export function useEngagement() {
  const { user } = useAuth()
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [authWallReason, setAuthWallReason] = useState('')
  const [upgradeReason, setUpgradeReason] = useState('')
  const [usage, setUsage] = useState<UsageStatus | null>(null)

  // Fetch usage status periodically
  const fetchUsage = useCallback(async (): Promise<UsageStatus | null> => {
    try {
      const res = await fetch('/api/usage/status')
      if (!res.ok) return null
      const data = await res.json()
      setUsage(data)
      return data
    } catch (error) {
      console.error('[useEngagement] fetchUsage failed:', error)
      return null
    }
  }, [])

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchUsage()
  }, [user, fetchUsage])

  /**
   * Check if an action is allowed. Shows appropriate modal if not.
   * Returns true if the action can proceed.
   */
  const checkAction = useCallback(
    async (action: string): Promise<boolean> => {
      // Design actions always require auth
      if (!user && action !== 'chat') {
        setAuthWallReason(
          action.startsWith('design')
            ? 'Sign up free to create AI designs'
            : 'Create a free account to continue'
        )
        setShowAuthWall(true)
        return false
      }

      // Fetch latest usage
      const status = await fetchUsage()
      if (!status) return true // Fail open if usage check fails

      const actionUsage = status.usage[action]
      if (!actionUsage) return true

      // Check if blocked (limit = 0 for anonymous)
      if (actionUsage.limit === 0) {
        if (!user) {
          setAuthWallReason(
            action.startsWith('design')
              ? 'Sign up free to create AI designs'
              : 'Create a free account to continue'
          )
          setShowAuthWall(true)
        }
        return false
      }

      // Check if over limit
      if (actionUsage.remaining <= 0 && actionUsage.limit > 0) {
        if (!user) {
          setAuthWallReason('Create a free account to keep chatting')
          setShowAuthWall(true)
        } else if (status.tier === 'free') {
          setUpgradeReason(
            action === 'chat'
              ? 'Get more with Premium'
              : 'Upgrade for more designs'
          )
          setShowUpgrade(true)
        }
        return false
      }

      return true
    },
    [user, fetchUsage]
  )

  return {
    showAuthWall,
    showUpgrade,
    setShowAuthWall,
    setShowUpgrade,
    authWallReason,
    upgradeReason,
    usage,
    checkAction,
    fetchUsage,
  }
}
