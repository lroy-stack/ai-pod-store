'use client'

/**
 * WelcomePopup - Fullscreen welcome dialog for first-time chat visitors
 *
 * Shows on /chat for unauthenticated users who haven't dismissed it this session.
 * Uses sessionStorage so it reappears on new browser sessions.
 */

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const STORAGE_KEY = 'pod-welcome-seen'

export function WelcomePopup() {
  const [open, setOpen] = useState(false)
  const { authenticated, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const t = useTranslations('engagement.welcome')

  useEffect(() => {
    if (loading) return
    if (authenticated) return
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return
    } catch {
      return
    }
    setOpen(true)
  }, [authenticated, loading])

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true')
    } catch {}
    setOpen(false)
  }

  const benefits = [t('benefit1'), t('benefit2'), t('benefit3')]

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center items-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 mb-2">
            <span className="text-2xl font-bold text-primary-foreground">P</span>
          </div>
          <DialogTitle className="text-2xl">
            {t('title', { brandName: process.env.NEXT_PUBLIC_SITE_NAME || 'Skapara' })}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4 bg-muted/30 rounded-xl px-6">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">{benefit}</span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t('subscriptionTeaser')}</p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            onClick={() => {
              dismiss()
              router.push(`/${locale}/auth/register`)
            }}
            className="w-full"
            size="lg"
          >
            {t('signUp')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              dismiss()
              router.push(`/${locale}/auth/login`)
            }}
            className="w-full"
            size="lg"
          >
            {t('logIn')}
          </Button>
        </div>

        <button
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground text-center pt-1 transition-colors"
        >
          {t('continueGuest')}
        </button>
      </DialogContent>
    </Dialog>
  )
}
