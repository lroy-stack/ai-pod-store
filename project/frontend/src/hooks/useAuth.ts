'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  name?: string
}

interface AuthState {
  user: User | null
  authenticated: boolean
  loading: boolean
}

// Storage key for cross-tab auth sync
const AUTH_STORAGE_KEY = 'pod-auth-sync'

// Event type for auth state changes
type AuthEvent = 'login' | 'logout' | 'session-check'

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    authenticated: false,
    loading: true,
  })

  useEffect(() => {
    // Check session on mount
    checkSession()

    // Set up periodic session check (every 5 minutes)
    const interval = setInterval(() => {
      checkSession()
    }, 5 * 60 * 1000)

    // Listen for storage events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY && e.newValue) {
        try {
          const event = JSON.parse(e.newValue) as {
            type: AuthEvent
            timestamp: number
          }

          // Only process recent events (within last 5 seconds)
          if (Date.now() - event.timestamp < 5000) {
            if (event.type === 'logout') {
              // Another tab logged out — update state immediately
              setState({
                user: null,
                authenticated: false,
                loading: false,
              })
            } else if (event.type === 'login' || event.type === 'session-check') {
              // Another tab logged in — re-check session
              checkSession()
            }
          }
        } catch (error) {
          console.error('Failed to parse auth storage event:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const broadcastAuthEvent = (type: AuthEvent) => {
    try {
      // Write to localStorage to trigger storage event in other tabs
      const event = {
        type,
        timestamp: Date.now(),
      }
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(event))
      // Clean up after a short delay
      setTimeout(() => {
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 100)
    } catch (error) {
      console.error('Failed to broadcast auth event:', error)
    }
  }

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include', // Include cookies
      })

      if (!response.ok) {
        throw new Error('Session check failed')
      }

      const data = await response.json()

      setState({
        user: data.user,
        authenticated: data.authenticated,
        loading: false,
      })

      // Broadcast session check event to other tabs
      if (data.authenticated) {
        broadcastAuthEvent('session-check')
      }
    } catch (error) {
      console.error('Session check error:', error)
      setState({
        user: null,
        authenticated: false,
        loading: false,
      })
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      setState({
        user: null,
        authenticated: false,
        loading: false,
      })

      // Broadcast logout event to other tabs
      broadcastAuthEvent('logout')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return {
    ...state,
    checkSession,
    logout,
  }
}
