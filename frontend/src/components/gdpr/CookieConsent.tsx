'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { hasConsent, acceptAll, rejectAll, saveConsent, getConsent } from '@/lib/cookie-consent';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

export function CookieConsent() {
  const t = useTranslations('cookieConsent');
  const params = useParams();
  const locale = params.locale as string || 'en';
  const [isVisible, setIsVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [preferences, setPreferences] = useState({
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if user has already made a consent choice
    if (!hasConsent()) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    acceptAll();
    setIsVisible(false);
    setShowCustomize(false);
  };

  const handleRejectAll = () => {
    rejectAll();
    setIsVisible(false);
    setShowCustomize(false);
  };

  const handleCustomize = () => {
    // Load current consent if exists
    const current = getConsent();
    if (current) {
      setPreferences({
        analytics: current.analytics,
        marketing: current.marketing,
      });
    }
    setShowCustomize(true);
  };

  const handleSaveCustom = () => {
    saveConsent(preferences);
    setIsVisible(false);
    setShowCustomize(false);
  };

  // Don't render anything if consent has been given
  if (!isVisible) return null;

  return (
    <>
      {/* Main Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom duration-300">
        <Card className={cn(
          "max-w-5xl mx-auto shadow-lg",
          "bg-card border-border"
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg md:text-xl">{t('title')}</CardTitle>
            <CardDescription className="text-sm md:text-base">
              {t('description')}{' '}
              <Link
                href={`/${locale}/cookies`}
                className="underline hover:text-foreground transition-colors"
              >
                {t('learnMore')}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 md:flex-row md:justify-end md:gap-3 pt-0">
            <Button
              variant="outline"
              onClick={handleRejectAll}
              className="w-full md:w-auto"
            >
              {t('rejectAll')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleCustomize}
              className="w-full md:w-auto"
            >
              {t('customize')}
            </Button>
            <Button
              onClick={handleAcceptAll}
              className="w-full md:w-auto"
            >
              {t('acceptAll')}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Customize Dialog */}
      <Dialog open={showCustomize} onOpenChange={setShowCustomize}>
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
              onClick={() => setShowCustomize(false)}
              className="w-full sm:w-auto"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSaveCustom}
              className="w-full sm:w-auto"
            >
              {t('savePreferences')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
