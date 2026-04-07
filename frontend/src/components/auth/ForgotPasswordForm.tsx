'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { apiFetch } from '@/lib/api-fetch'

export default function ForgotPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, turnstileToken: turnstileToken || undefined }),
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
      <div className="w-full space-y-6">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {t('checkYourEmail')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('resetEmailSent')}
          </p>
        </div>

        <div className="rounded-md bg-success/10 p-3 text-sm text-success">
          <p className="font-medium">{t('passwordResetEmailSent')}</p>
          <p className="mt-1 text-success/80">{t('checkSpamFolder')}</p>
        </div>

        <div className="text-center">
          <Button variant="link" asChild>
            <Link href={`/${locale}/auth/login`}>
              {t('backToLogin')}
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
          {t('forgotPasswordTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('forgotPasswordDescription')}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder={t('emailPlaceholder')}
          />
        </div>

        {/* Cloudflare Turnstile CAPTCHA */}
        <TurnstileWidget
          onVerify={(token) => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken(null)}
          onError={() => setTurnstileToken(null)}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('sendingResetLink')}
            </>
          ) : (
            t('sendResetLink')
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
