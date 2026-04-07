'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Settings } from 'lucide-react'
import { saveConsent, getConsent } from '@/lib/cookie-consent'

export function CookieSettingsButton() {
  const t = useTranslations('cookieConsent')
  const [showDialog, setShowDialog] = useState(false)
  const [preferences, setPreferences] = useState(() => {
    // Load current consent state
    const current = getConsent()
    return {
      analytics: current?.analytics ?? false,
      marketing: current?.marketing ?? false,
    }
  })

  const handleOpenDialog = () => {
    // Refresh preferences from current consent
    const current = getConsent()
    if (current) {
      setPreferences({
        analytics: current.analytics,
        marketing: current.marketing,
      })
    }
    setShowDialog(true)
  }

  const handleSave = () => {
    saveConsent(preferences)
    setShowDialog(false)
  }

  return (
    <>
      <Button
        variant="default"
        onClick={handleOpenDialog}
        className="w-full md:w-auto"
      >
        <Settings className="h-4 w-4 mr-2" />
        {t('customize')}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('customizeTitle')}</DialogTitle>
            <DialogDescription>
              {t('customizeDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Necessary Cookies (Always On) */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-base font-medium">
                  {t('categories.necessary.title')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('categories.necessary.description')}
                </p>
              </div>
              <Switch
                checked={true}
                disabled
                aria-label={t('categories.necessary.title')}
              />
            </div>

            {/* Analytics Cookies */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="analytics" className="text-base font-medium cursor-pointer">
                  {t('categories.analytics.title')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('categories.analytics.description')}
                </p>
              </div>
              <Switch
                id="analytics"
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, analytics: checked }))
                }
                aria-label={t('categories.analytics.title')}
              />
            </div>

            {/* Marketing Cookies */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="marketing" className="text-base font-medium cursor-pointer">
                  {t('categories.marketing.title')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('categories.marketing.description')}
                </p>
              </div>
              <Switch
                id="marketing"
                checked={preferences.marketing}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, marketing: checked }))
                }
                aria-label={t('categories.marketing.title')}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="w-full sm:w-auto"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              className="w-full sm:w-auto"
            >
              {t('savePreferences')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
