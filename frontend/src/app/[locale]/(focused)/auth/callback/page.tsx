'use client'

/**
 * OAuth Callback Page
 *
 * This page handles the OAuth callback from Google and Apple Sign-In.
 * After the user approves on the provider's consent screen, they're redirected here.
 *
 * The Supabase client automatically exchanges the OAuth code for a session.
 * We then redirect the user to the homepage.
 */

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-fetch'
import { getSafeRedirectUrl } from '@/lib/safe-redirect'

export default function AuthCallbackPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Supabase automatically handles the OAuth code exchange
        // We just need to check if the user is now authenticated
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (session) {
          // Set HTTP-only cookies so server-side API routes can read the session
          try {
            await fetch('/api/auth/set-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_in: session.expires_in,
              }),
              credentials: 'include',
            })
          } catch {
            // Non-critical — session cookies will be set on next page load
          }

          // Migrate anonymous session data to new user
          try {
            const fp = localStorage.getItem('pod-fp-id')
            const convId = sessionStorage.getItem('pod-conversation-id')
            if (fp || convId) {
              await apiFetch('/api/session/migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fingerprint: fp || undefined,
                  conversationIds: convId ? [convId] : undefined,
                }),
              })
            }
          } catch {
            // Non-critical — ignore migration errors
          }

          // Merge anonymous guest cart into user's cart
          try {
            await apiFetch('/api/cart/merge', { method: 'POST' })
          } catch {
            // Non-critical — ignore cart merge errors
          }

          // Detect user's browser language, map to supported locales (de/es/en)
          const browserLang = (navigator.language || '').toLowerCase()
          const detectedLocale = browserLang.startsWith('de') ? 'de'
            : browserLang.startsWith('es') ? 'es'
            : locale // fall back to URL locale

          // Send welcome email for new users (non-blocking)
          fetch('/api/auth/welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ locale: detectedLocale }),
          }).catch(() => {})

          // Broadcast login event for other tabs
          try {
            localStorage.setItem('pod-auth-sync', JSON.stringify({ type: 'login', timestamp: Date.now() }))
            setTimeout(() => { try { localStorage.removeItem('pod-auth-sync') } catch (_e) { /* ignore */ } }, 100)
          } catch (_e) { /* ignore */ }

          // OAuth login successful — redirect to saved returnUrl or homepage
          const returnUrl = sessionStorage.getItem('auth-return-url')
          sessionStorage.removeItem('auth-return-url')
          window.location.href = getSafeRedirectUrl(returnUrl, `/${locale}/`)
        } else {
          // No session — something went wrong
          setError('Authentication failed. Please try again.')
          setTimeout(() => {
            router.push(`/${locale}/auth/login`)
          }, 3000)
        }
      } catch (err) {
        console.error('OAuth callback error:', err)
        setError('Authentication failed. Please try again.')
        setTimeout(() => {
          router.push(`/${locale}/auth/login`)
        }, 3000)
      }
    }

    handleOAuthCallback()
  }, [router, locale])

  if (error) {
    return (
      <div className="mx-auto max-w-md">
        <div className="w-full">
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-center">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <p className="mt-2 text-xs text-destructive/80">Redirecting to login...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">Completing sign-in...</p>
    </div>
  )
}
