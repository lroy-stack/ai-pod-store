'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ResetPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Get the access token from URL hash (Supabase sends it there)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    // Supabase sends the token in the URL hash
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const token = params.get('access_token')
      if (token) {
        setAccessToken(token)
      } else {
        setError('Invalid or expired reset link')
      }
    } else {
      setError('Invalid or expired reset link')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsDoNotMatch'))
      return
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError(t('passwordTooShort'))
      return
    }

    if (!accessToken) {
      setError('Invalid or expired reset link')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: formData.password,
          accessToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setSuccess(true)
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push(`/${locale}/auth/login?reset=success`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  if (success) {
    return (
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            {t('passwordResetSuccess')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t('redirectingToLogin')}
          </p>
        </div>

        <div className="rounded-md bg-success/10 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-success">
                {t('passwordResetSuccessMessage')}
              </h3>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          {t('resetPasswordTitle')}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t('resetPasswordDescription')}
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
        <div className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              {t('newPasswordLabel')}
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                disabled={loading || !accessToken}
                className="appearance-none block w-full px-3 py-2 border border-border rounded-md placeholder:text-muted-foreground text-foreground focus:outline-none focus:ring-ring focus:border-ring sm:text-sm disabled:opacity-50"
                placeholder={t('newPasswordPlaceholder')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
              {t('confirmPasswordLabel')}
            </label>
            <div className="mt-1">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading || !accessToken}
                className="appearance-none block w-full px-3 py-2 border border-border rounded-md placeholder:text-muted-foreground text-foreground focus:outline-none focus:ring-ring focus:border-ring sm:text-sm disabled:opacity-50"
                placeholder={t('confirmPasswordPlaceholder')}
              />
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading || !accessToken}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('resettingPassword') : t('resetPasswordButton')}
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
