'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'

export default function RegisterForm({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }

    if (!formData.terms) {
      setError(t('termsRequired'))
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/${locale}/auth/callback`,
        },
      })

      if (error) {
        throw error
      }

      // Supabase will redirect to the OAuth provider's consent screen
      // After user approves, they'll be redirected back to /auth/callback
    } catch (err) {
      console.error(`${provider} login error:`, err)
      setError(t('socialLoginFailed'))
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          {t('registerTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('haveAccount')}{' '}
          <Link href={`/${locale}/auth/login`} className="font-medium text-primary hover:text-primary/80">
            {t('loginLink')}
          </Link>
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-success/10 p-3 text-sm text-success">
          <p className="font-medium">{t('registrationSuccess')}</p>
          <p className="mt-1 text-success/80">{t('checkEmailForVerification')}</p>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">{t('nameLabel')}</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={loading || success}
            placeholder={t('namePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={loading || success}
            placeholder={t('emailPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={loading || success}
              placeholder={t('passwordPlaceholder')}
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
              disabled={loading || success}
              placeholder={t('confirmPasswordPlaceholder')}
            />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={formData.terms}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, terms: checked === true })
            }
            disabled={loading || success}
            required
          />
          <Label htmlFor="terms" className="text-sm font-normal leading-snug">
            {t('agreeToTerms')}{' '}
            <Link href={`/${locale}/legal/terms`} className="text-primary hover:text-primary/80">
              {t('termsLink')}
            </Link>{' '}
            {t('and')}{' '}
            <Link href={`/${locale}/legal/privacy`} className="text-primary hover:text-primary/80">
              {t('privacyLink')}
            </Link>
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={loading || success}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('registeringButton')}
            </>
          ) : (
            t('registerButton')
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-card px-2 text-muted-foreground">{t('orContinueWith')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" onClick={() => handleSocialLogin('google')} disabled={loading}>
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t('googleLogin')}
        </Button>

        <Button type="button" variant="outline" onClick={() => handleSocialLogin('apple')} disabled={loading}>
          <svg className="size-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M13.762 4.29a6.51 6.51 0 0 0-5.024 3.834 6.034 6.034 0 0 0-.544 2.457 6.474 6.474 0 0 0 .544 2.457 6.486 6.486 0 0 0 1.504 2.104c1.048 1.025 2.385 1.637 3.898 1.785 1.513.148 2.982-.166 4.135-1.012a5.827 5.827 0 0 0 2.145-3.292c.135-.503.2-1.019.193-1.537-.007-.518-.082-1.034-.223-1.534a5.982 5.982 0 0 0-2.126-3.194A5.827 5.827 0 0 0 13.762 4.29zM10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0z"/>
          </svg>
          {t('appleLogin')}
        </Button>
      </div>
    </div>
  )
}
