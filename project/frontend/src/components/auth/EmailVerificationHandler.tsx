'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function EmailVerificationHandler({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_verified'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      // Get the token from URL hash (Supabase sends it there)
      const hash = window.location.hash
      if (!hash) {
        setStatus('error')
        setError(t('invalidVerificationLink'))
        return
      }

      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      const type = params.get('type')

      if (!accessToken || type !== 'signup') {
        setStatus('error')
        setError(t('invalidVerificationLink'))
        return
      }

      try {
        // Call our verification API endpoint
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accessToken }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (data.alreadyVerified) {
            setStatus('already_verified')
          } else {
            throw new Error(data.error || 'Verification failed')
          }
        } else {
          setStatus('success')
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push(`/${locale}/auth/login?verified=true`)
          }, 3000)
        }
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Verification failed')
      }
    }

    verifyEmail()
  }, [locale, router])

  if (status === 'loading') {
    return (
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            {t('verifyingEmail')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t('pleaseWait')}
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            {t('emailVerifiedSuccess')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t('redirectingToLogin')}
          </p>
        </div>

        <div className="rounded-md bg-success/10 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-success">
                {t('emailVerifiedMessage')}
              </h3>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href={`/${locale}/auth/login`}
            className="font-medium text-primary hover:text-primary/80"
          >
            {t('continueToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'already_verified') {
    return (
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            {t('emailAlreadyVerified')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t('emailAlreadyVerifiedDescription')}
          </p>
        </div>

        <div className="text-center">
          <Link
            href={`/${locale}/auth/login`}
            className="font-medium text-primary hover:text-primary/80"
          >
            {t('continueToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          {t('verificationFailed')}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t('verificationFailedDescription')}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-destructive">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <Link
          href={`/${locale}/auth/register`}
          className="font-medium text-primary hover:text-primary/80"
        >
          {t('tryRegisterAgain')}
        </Link>
      </div>
    </div>
  )
}
