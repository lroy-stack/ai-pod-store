'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Bell, Check } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useTranslations } from 'next-intl'

interface PushPermissionPromptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PushPermissionPrompt({ open, onOpenChange }: PushPermissionPromptProps) {
  const { requestPermission, loading, supported } = usePushNotifications()
  const t = useTranslations('engagement.notifications')

  if (!supported) return null

  const notificationTypes = [t('type1'), t('type2'), t('type3')]

  async function handleEnable() {
    await requestPermission()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          {notificationTypes.map((type) => (
            <div key={type} className="flex items-center gap-2 text-sm">
              <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              {type}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleEnable} disabled={loading} className="flex-1">
            {loading ? t('enabling') : t('enable')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {t('notNow')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
