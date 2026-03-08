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

          // OAuth login successful — redirect to homepage
          router.push(`/${locale}/`)
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
