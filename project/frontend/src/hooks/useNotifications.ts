'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'

interface UseNotificationsResult {
  unreadCount: number
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch unread notification count for the authenticated user
 */
export function useNotifications(): UseNotificationsResult {
  const { authenticated, loading: authLoading } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchCount = async () => {
    if (!authenticated) {
      setUnreadCount(0)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/notifications/count')

      if (!response.ok) {
        if (response.status === 401) {
          // User is not authenticated, silently reset count
          setUnreadCount(0)
          return
        }
        throw new Error('Failed to fetch notification count')
      }

      const data = await response.json()
      setUnreadCount(data.count ?? 0)
    } catch (err) {
      console.error('Error fetching notification count:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only fetch if auth is loaded and user is authenticated
    if (!authLoading) {
      fetchCount()
    }
  }, [authenticated, authLoading])

  return {
    unreadCount,
    loading,
    error,
    refetch: fetchCount,
  }
}
