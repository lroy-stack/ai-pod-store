'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, Sparkles } from 'lucide-react'
import { apiFetch } from '@/lib/api-fetch'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
}

export function UpgradeModal({ open, onOpenChange, reason }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false)
  const t = useTranslations('engagement.upgrade')

  const freeFeatures = [t('free1'), t('free2'), t('free3')]
  const premiumFeatures = [t('premium1'), t('premium2'), t('premium3'), t('premium4'), t('premium5')]

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/subscription/create', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('title')}
          </DialogTitle>
          {reason && (
            <DialogDescription>{reason}</DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          {/* Free column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{t('freeBadge')}</Badge>
            </div>
            {freeFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {/* Premium column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary">{t('premiumBadge')}</Badge>
              <span className="text-sm font-medium text-foreground">{t('price')}</span>
            </div>
            {premiumFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={handleUpgrade} disabled={loading} className="w-full">
            {loading ? t('redirecting') : t('upgradeNow')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
