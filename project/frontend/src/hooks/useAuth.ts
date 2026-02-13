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

    return () => clearInterval(interval)
  }, [])

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
