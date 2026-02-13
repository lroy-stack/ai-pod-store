'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function ForgotPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            {t('checkYourEmail')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t('resetEmailSent')}
          </p>
        </div>

        <div className="rounded-md bg-success/10 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-success">
                {t('passwordResetEmailSent')}
              </h3>
              <p className="mt-2 text-sm text-success/80">
                {t('checkSpamFolder')}
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href={`/${locale}/auth/login`}
            className="font-medium text-primary hover:text-primary/80"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          {t('forgotPasswordTitle')}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t('forgotPasswordDescription')}
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

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            {t('emailLabel')}
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="appearance-none block w-full px-3 py-2 border border-border rounded-md placeholder:text-muted-foreground text-foreground focus:outline-none focus:ring-ring focus:border-ring sm:text-sm disabled:opacity-50"
              placeholder={t('emailPlaceholder')}
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('sendingResetLink') : t('sendResetLink')}
          </button>
        </div>

        <div className="text-center text-sm">
          <Link href={`/${locale}/auth/login`} className="font-medium text-primary hover:text-primary/80">
            {t('backToLogin')}
          </Link>
        </div>
      </form>
    </div>
  )
}
