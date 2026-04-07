'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { apiFetch } from '@/lib/api-fetch'
import { getSafeRedirectUrl } from '@/lib/safe-redirect'

export default function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string
    password?: string
  }>({})
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const justRegistered = searchParams.get('registered') === 'true'

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {}

    // Validate email
    if (!formData.email) {
      errors.email = t('emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('emailInvalid')
    }

    // Validate password
    if (!formData.password) {
      errors.password = t('passwordRequired')
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    // Validate form
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          turnstileToken: turnstileToken || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Broadcast login event to other tabs
      try {
        const event = {
          type: 'login',
          timestamp: Date.now(),
        }
        localStorage.setItem('pod-auth-sync', JSON.stringify(event))
        setTimeout(() => {
          try {
            localStorage.removeItem('pod-auth-sync')
          } catch (e) {
            // Ignore cleanup errors
          }
        }, 100)
      } catch (e) {
        console.error('Failed to broadcast login event:', e)
      }

      // Merge anonymous guest cart into user's cart
      try {
        await apiFetch('/api/cart/merge', { method: 'POST' })
      } catch {
        // Non-critical — ignore cart merge errors
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

      // Redirect to returnUrl if present, otherwise to chat
      const userLocale = data.user?.locale || locale
      const returnUrl = searchParams.get('returnUrl')
      router.push(getSafeRedirectUrl(returnUrl, `/${userLocale}/chat`))
    } catch (err) {
      // Translate error messages based on error content
      if (err instanceof Error && err.message.includes('Invalid email or password')) {
        setError(t('invalidCredentials'))
      } else {
        setError(t('loginFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    try {
      setLoading(true)
      setError('')

      // Save returnUrl so callback can redirect back after OAuth
      // Priority: explicit returnUrl param > referrer page > null (homepage)
      const returnUrl = searchParams.get('returnUrl') || document.referrer
      if (returnUrl && !returnUrl.includes('/auth/')) {
        sessionStorage.setItem('auth-return-url', returnUrl.startsWith('http')
          ? new URL(returnUrl).pathname
          : returnUrl)
      }

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
    <div className="w-full space-y-4 md:space-y-6">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {t('loginTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href={`/${locale}/auth/register`} className="font-medium text-primary hover:text-primary/80">
            {t('signUpLink')}
          </Link>
        </p>
      </div>

      {justRegistered && (
        <div className="rounded-md bg-success/10 p-3 text-sm font-medium text-success">
          {t('registrationSuccess')} {t('pleaseLogin')}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <form className="space-y-3 md:space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value })
              // Clear field error when user types
              if (fieldErrors.email) {
                setFieldErrors({ ...fieldErrors, email: undefined })
              }
            }}
            disabled={loading}
            placeholder={t('emailPlaceholder')}
            className={fieldErrors.email ? 'border-destructive' : ''}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('passwordLabel')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={(e) => {
              setFormData({ ...formData, password: e.target.value })
              // Clear field error when user types
              if (fieldErrors.password) {
                setFieldErrors({ ...fieldErrors, password: undefined })
              }
            }}
            disabled={loading}
            placeholder={t('passwordPlaceholder')}
            className={fieldErrors.password ? 'border-destructive' : ''}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rememberMe"
              checked={formData.rememberMe}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, rememberMe: checked === true })
              }
              disabled={loading}
            />
            <Label htmlFor="rememberMe" className="text-sm font-normal">
              {t('rememberMe')}
            </Label>
          </div>

          <Link
            href={`/${locale}/auth/forgot-password`}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            {t('forgotPassword')}
          </Link>
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
              {t('loggingIn')}
            </>
          ) : (
            t('loginButton')
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-card/80 backdrop-blur-sm px-2 text-muted-foreground">{t('orContinueWith')}</span>
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
          <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          {t('appleLogin')}
        </Button>
      </div>
    </div>
  )
}
