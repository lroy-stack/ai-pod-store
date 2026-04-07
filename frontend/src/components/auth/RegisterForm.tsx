'use client'

import { useState, useMemo } from 'react'
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
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { apiFetch } from '@/lib/api-fetch'

function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return 1
  if (score <= 3) return 2
  return 3
}

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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
    terms?: string
  }>({})

  const passwordStrength = useMemo(() => getPasswordStrength(formData.password), [formData.password])

  const strengthLabel = passwordStrength === 1 ? t('passwordWeak') : passwordStrength === 2 ? t('passwordMedium') : passwordStrength === 3 ? t('passwordStrong') : ''
  const strengthColor = passwordStrength === 1 ? 'bg-destructive' : passwordStrength === 2 ? 'bg-warning' : passwordStrength === 3 ? 'bg-success' : 'bg-muted'

  const validateForm = () => {
    const errors: typeof fieldErrors = {}

    if (!formData.name.trim()) {
      errors.name = t('nameRequired')
    }

    if (!formData.email) {
      errors.email = t('emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('emailInvalid')
    }

    if (!formData.password) {
      errors.password = t('passwordRequired')
    } else if (formData.password.length < 8) {
      errors.password = t('passwordMin')
    }

    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = t('passwordMismatch')
    }

    if (!formData.terms) {
      errors.terms = t('termsRequired')
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setSuccess(false)

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          turnstileToken: turnstileToken || undefined,
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

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
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

      <form className="space-y-3 md:space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">{t('nameLabel')}</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value })
              clearFieldError('name')
            }}
            disabled={loading || success}
            placeholder={t('namePlaceholder')}
            className={fieldErrors.name ? 'border-destructive' : ''}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
          />
          {fieldErrors.name && (
            <p id="name-error" className="text-sm text-destructive">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value })
              clearFieldError('email')
            }}
            disabled={loading || success}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value })
                clearFieldError('password')
              }}
              disabled={loading || success}
              placeholder={t('passwordPlaceholder')}
              className={fieldErrors.password ? 'border-destructive' : ''}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : 'password-strength'}
            />
            {fieldErrors.password && (
              <p id="password-error" className="text-sm text-destructive">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={(e) => {
                setFormData({ ...formData, confirmPassword: e.target.value })
                clearFieldError('confirmPassword')
              }}
              disabled={loading || success}
              placeholder={t('confirmPasswordPlaceholder')}
              className={fieldErrors.confirmPassword ? 'border-destructive' : ''}
              aria-invalid={!!fieldErrors.confirmPassword}
              aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
            />
            {fieldErrors.confirmPassword && (
              <p id="confirm-password-error" className="text-sm text-destructive">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        {formData.password && (
          <div id="password-strength" className="space-y-1.5" aria-live="polite">
            <div className="flex gap-1.5">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    passwordStrength >= level ? strengthColor : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            {strengthLabel && (
              <p className="text-xs text-muted-foreground">{strengthLabel}</p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="terms" className="flex items-start gap-2 cursor-pointer select-none">
            <Checkbox
              id="terms"
              checked={formData.terms}
              onCheckedChange={(checked) => {
                setFormData({ ...formData, terms: checked === true })
                clearFieldError('terms')
              }}
              disabled={loading || success}
              className="mt-0.5 shrink-0"
            />
            <span className="text-xs md:text-sm leading-relaxed text-muted-foreground">
              {t('agreeToTerms')}{' '}
              <Link href={`/${locale}/terms`} className="text-primary hover:text-primary/80">
                {t('termsLink')}
              </Link>{' '}
              {t('and')}{' '}
              <Link href={`/${locale}/privacy`} className="text-primary hover:text-primary/80">
                {t('privacyLink')}
              </Link>
            </span>
          </label>
          {fieldErrors.terms && (
            <p className="text-xs text-destructive pl-6">
              {fieldErrors.terms}
            </p>
          )}
        </div>

        {/* Cloudflare Turnstile CAPTCHA */}
        <TurnstileWidget
          onVerify={(token) => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken(null)}
          onError={() => setTurnstileToken(null)}
        />

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
