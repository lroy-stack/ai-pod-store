'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-fetch'
import { motion, useReducedMotion } from 'motion/react'
import { FADE_UP } from '@/hooks/useMotionConfig'

interface NewsletterSignupProps {
  locale: 'en' | 'es' | 'de'
}

export function NewsletterSignup({ locale }: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const messages = {
    en: {
      title: 'Join the club',
      subtitle: 'New drops, exclusive offers, and first dibs',
      placeholder: 'Enter your email',
      button: 'Subscribe',
      success: 'Check your email to confirm your subscription!',
      error: 'Failed to subscribe. Please try again.',
      invalid: 'Please enter a valid email address',
    },
    es: {
      title: 'Únete al club',
      subtitle: 'Nuevos lanzamientos, ofertas exclusivas y acceso anticipado',
      placeholder: 'Ingresa tu correo',
      button: 'Suscribirse',
      success: '¡Revisa tu correo para confirmar tu suscripción!',
      error: 'Error al suscribirse. Por favor, inténtalo de nuevo.',
      invalid: 'Por favor, ingresa un correo válido',
    },
    de: {
      title: 'Werde Teil des Clubs',
      subtitle: 'Neue Drops, exklusive Angebote und Frühzugang',
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
      const res = await apiFetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    <div className="relative isolate w-full max-w-xl mx-auto text-center px-4 py-2">
      {/* Decorative pulsing gradient */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 rounded-3xl bg-primary/5 blur-3xl -z-10"
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <motion.div
        variants={FADE_UP}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
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
      </motion.div>
    </div>
  )
}
