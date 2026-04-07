'use client'

import { useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useUsage, type UsageStatus } from '@/providers/UsageProvider'

export type { UsageStatus }

export function useEngagement() {
  const { user } = useAuth()
  const { usage, refreshUsage } = useUsage()
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [authWallReason, setAuthWallReason] = useState('')
  const [upgradeReason, setUpgradeReason] = useState('')

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

      // Fetch latest usage (shared — deduplicated by UsageProvider)
      const status = await refreshUsage()
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
    [user, refreshUsage]
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
    fetchUsage: refreshUsage, // backward-compat alias
  }
}
