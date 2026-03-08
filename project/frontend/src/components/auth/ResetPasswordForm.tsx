'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api-fetch'

export default function ResetPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const router = useRouter()
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
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

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsDoNotMatch'))
      return
    }

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
      const response = await apiFetch('/api/auth/reset-password', {
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
      setTimeout(() => {
        router.push(`/${locale}/auth/login?reset=success`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full space-y-6">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {t('passwordResetSuccess')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('redirectingToLogin')}
          </p>
        </div>

        <div className="rounded-md bg-success/10 p-3 text-sm font-medium text-success">
          {t('passwordResetSuccessMessage')}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          {t('resetPasswordTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('resetPasswordDescription')}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="password">{t('newPasswordLabel')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            disabled={loading || !accessToken}
            placeholder={t('newPasswordPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            disabled={loading || !accessToken}
            placeholder={t('confirmPasswordPlaceholder')}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading || !accessToken}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('resettingPassword')}
            </>
          ) : (
            t('resetPasswordButton')
          )}
        </Button>

        <div className="text-center">
          <Button variant="link" asChild>
            <Link href={`/${locale}/auth/login`}>
              {t('backToLogin')}
            </Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
