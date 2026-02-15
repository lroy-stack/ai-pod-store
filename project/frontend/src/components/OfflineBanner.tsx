'use client'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const t = useTranslations('Offline')

  if (isOnline) {
    return null
  }

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <p className="font-medium">{t('banner')}</p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          size="sm"
          className="flex-shrink-0 text-xs gap-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          {t('tryAgain')}
        </Button>
      </div>
    </div>
  )
}
