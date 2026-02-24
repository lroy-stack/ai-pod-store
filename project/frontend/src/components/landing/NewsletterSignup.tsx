'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/csrf'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

interface NewsletterSignupProps {
  locale: 'en' | 'es' | 'de'
}

export function NewsletterSignup({ locale }: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const messages = {
    en: {
      title: 'Stay Updated',
      subtitle: 'Get the latest designs, tips, and exclusive offers',
      placeholder: 'Enter your email',
      button: 'Subscribe',
      success: 'Check your email to confirm your subscription!',
      error: 'Failed to subscribe. Please try again.',
      invalid: 'Please enter a valid email address',
    },
    es: {
      title: 'Mantente Actualizado',
      subtitle: 'Recibe los últimos diseños, consejos y ofertas exclusivas',
      placeholder: 'Ingresa tu correo',
      button: 'Suscribirse',
      success: '¡Revisa tu correo para confirmar tu suscripción!',
      error: 'Error al suscribirse. Por favor, inténtalo de nuevo.',
      invalid: 'Por favor, ingresa un correo válido',
    },
    de: {
      title: 'Bleiben Sie auf dem Laufenden',
      subtitle: 'Erhalten Sie die neuesten Designs, Tipps und exklusive Angebote',
      placeholder: 'E-Mail eingeben',
      button: 'Abonnieren',
      success: 'Überprüfen Sie Ihre E-Mail, um Ihr Abonnement zu bestätigen!',
      error: 'Abonnement fehlgeschlagen. Bitte versuchen Sie es erneut.',
      invalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    },
  }

  const t = messages[locale]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      toast.error(t.invalid)
      return
    }

    setLoading(true)

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME)
      if (!csrfToken) {
        toast.error('Security token missing. Please refresh the page.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({ email, locale }),
      })

      if (!res.ok) {
        throw new Error('Subscription failed')
      }

      toast.success(t.success)

      setEmail('')
    } catch (error) {
      toast.error(t.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto text-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-2">{t.title}</h2>
      <p className="text-muted-foreground mb-6">{t.subtitle}</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <Input
          type="email"
          placeholder={t.placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="flex-1"
          required
        />
        <Button type="submit" disabled={loading} className="min-w-[120px]">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ...
            </>
          ) : (
            t.button
          )}
        </Button>
      </form>
    </div>
  )
}
