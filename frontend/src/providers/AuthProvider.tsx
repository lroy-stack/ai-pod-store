'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { apiFetch } from '@/lib/api-fetch'

export interface AuthUser {
  id: string
  email: string
  name?: string
  avatar_url?: string
  locale?: string
  currency?: string
}

interface AuthState {
  user: AuthUser | null
  authenticated: boolean
  loading: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  checkSession: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const AUTH_STORAGE_KEY = 'pod-auth-sync'
type AuthEvent = 'login' | 'logout' | 'session-check'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    authenticated: false,
    loading: true,
    error: null,
  })

  const broadcastAuthEvent = useCallback((type: AuthEvent) => {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ type, timestamp: Date.now() }))
      setTimeout(() => {
        try { localStorage.removeItem(AUTH_STORAGE_KEY) } catch (_e) { /* ignore */ }
      }, 100)
    } catch (_e) { /* ignore */ }
  }, [])

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Session check failed')
      const data = await response.json()
      setState({
        user: data.user,
        authenticated: data.authenticated,
        loading: false,
        error: null,
      })
      if (data.authenticated) broadcastAuthEvent('session-check')
    } catch (_e) {
      setState({ user: null, authenticated: false, loading: false, error: 'Session check failed' })
    }
  }, [broadcastAuthEvent])

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch (_e) { /* ignore */ }
    // Clear chat session to prevent data leak between users
    try {
      const userId = state.user?.id
      if (userId) {
        const prefix = `pod-chat-${userId}`
        localStorage.removeItem(`${prefix}-messages`)
        localStorage.removeItem(`${prefix}-ts`)
        localStorage.removeItem(`${prefix}-cid`)
      }
    } catch { /* SSR guard */ }
    setState({ user: null, authenticated: false, loading: false, error: null })
    broadcastAuthEvent('logout')
  }, [broadcastAuthEvent])

  useEffect(() => {
    checkSession()

    // Re-check every 5 minutes from a single timer (not per component)
    const interval = setInterval(checkSession, 5 * 60 * 1000)

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== AUTH_STORAGE_KEY || !e.newValue) return
      try {
        const event = JSON.parse(e.newValue) as { type: AuthEvent; timestamp: number }
        if (Date.now() - event.timestamp > 5000) return
        if (event.type === 'logout') {
          setState({ user: null, authenticated: false, loading: false, error: null })
        } else {
          checkSession()
        }
      } catch (_e) { /* ignore */ }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [checkSession])

  return (
    <AuthContext.Provider value={{ ...state, checkSession, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
