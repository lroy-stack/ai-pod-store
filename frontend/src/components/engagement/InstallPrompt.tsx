'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { X, Download } from 'lucide-react'
import { BRAND } from '@/lib/store-config'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const t = useTranslations('engagement.install')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Track visits
    const visits = Number(localStorage.getItem('pod-visit-count') || '0') + 1
    localStorage.setItem('pod-visit-count', String(visits))

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem('pod-install-dismissed')
    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismiss < 7) return
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      if (visits >= 3) setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('pod-install-dismissed', String(Date.now()))
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-card border border-border rounded-lg shadow-lg p-4 flex items-start gap-3">
      <Download className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{t('title', { brandName: BRAND.name })}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('description')}
        </p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" onClick={handleInstall} className="h-7 text-xs">
            {t('install')}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-7 text-xs">
            {t('notNow')}
          </Button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
