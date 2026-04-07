'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-fetch'

export default function EmailVerificationHandler({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_verified'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
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
        const response = await apiFetch('/api/auth/verify-email', {
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
      <div className="w-full space-y-6">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {t('verifyingEmail')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('pleaseWait')}
          </p>
        </div>
        <div className="flex justify-center">
          <Loader2 className="size-10 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="w-full space-y-6">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {t('emailVerifiedSuccess')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('redirectingToLogin')}
          </p>
        </div>

        <div className="rounded-md bg-success/10 p-3 text-sm font-medium text-success">
          {t('emailVerifiedMessage')}
        </div>

        <div className="text-center">
          <Button variant="link" asChild>
            <Link href={`/${locale}/auth/login`}>
              {t('continueToLogin')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'already_verified') {
    return (
      <div className="w-full space-y-6">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {t('emailAlreadyVerified')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('emailAlreadyVerifiedDescription')}
          </p>
        </div>

        <div className="text-center">
          <Button variant="link" asChild>
            <Link href={`/${locale}/auth/login`}>
              {t('continueToLogin')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          {t('verificationFailed')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('verificationFailedDescription')}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="text-center">
        <Button variant="link" asChild>
          <Link href={`/${locale}/auth/register`}>
            {t('tryRegisterAgain')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
