'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Cookie } from 'lucide-react'

interface CookiePreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  preferences: boolean
}

const COOKIE_CONSENT_KEY = 'cookie_consent'
const COOKIE_PREFERENCES_KEY = 'cookie_preferences'

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always required
    analytics: false,
    marketing: false,
    preferences: false,
  })

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      setShowBanner(true)
    }

    // Load saved preferences if they exist
    const savedPreferences = localStorage.getItem(COOKIE_PREFERENCES_KEY)
    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences))
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [])

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs))
    setPreferences(prefs)
    setShowBanner(false)
    setShowCustomize(false)

    // Apply consent by enabling/disabling tracking
    applyConsent(prefs)
  }

  const applyConsent = (prefs: CookiePreferences) => {
    // Analytics (Google Analytics, etc.)
    if (prefs.analytics) {
      // Enable analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          analytics_storage: 'granted',
        })
      }
    } else {
      // Disable analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          analytics_storage: 'denied',
        })
      }
    }

    // Marketing (ads, social media pixels)
    if (prefs.marketing) {
      // Enable marketing
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
        })
      }
    } else {
      // Disable marketing
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
        })
      }
    }
  }

  const handleAcceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    })
  }

  const handleRejectNonEssential = () => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    })
  }

  const handleCustomize = () => {
    setShowCustomize(true)
  }

  const handleSaveCustom = () => {
    saveConsent(preferences)
  }

  if (!showBanner) {
    return null
  }

  return (
    <>
      {/* Cookie Consent Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Cookie className="h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">We use cookies</p>
                <p className="text-xs text-muted-foreground">
                  We use cookies to enhance your browsing experience, serve personalized content,
                  and analyze our traffic. By clicking "Accept All", you consent to our use of
                  cookies.{' '}
                  <a
                    href="/privacy"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    Privacy Policy
                  </a>
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRejectNonEssential}
                className="w-full sm:w-auto"
              >
                Reject Non-Essential
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCustomize}
                className="w-full sm:w-auto"
              >
                Customize
              </Button>
              <Button size="sm" onClick={handleAcceptAll} className="w-full sm:w-auto">
                Accept All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Customize Dialog */}
      <Dialog open={showCustomize} onOpenChange={setShowCustomize}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cookie Preferences</DialogTitle>
            <DialogDescription>
              Choose which types of cookies you want to allow. Necessary cookies are always
              enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Necessary Cookies (always on) */}
            <div className="flex items-start justify-between space-x-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="necessary" className="font-medium">
                  Necessary Cookies
                </Label>
                <p className="text-xs text-muted-foreground">
                  Essential for the website to function. Cannot be disabled.
                </p>
              </div>
              <Switch id="necessary" checked={true} disabled />
            </div>

            {/* Analytics Cookies */}
            <div className="flex items-start justify-between space-x-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="analytics" className="font-medium">
                  Analytics Cookies
                </Label>
                <p className="text-xs text-muted-foreground">
                  Help us understand how visitors interact with our website.
                </p>
              </div>
              <Switch
                id="analytics"
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, analytics: checked })
                }
              />
            </div>

            {/* Marketing Cookies */}
            <div className="flex items-start justify-between space-x-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="marketing" className="font-medium">
                  Marketing Cookies
                </Label>
                <p className="text-xs text-muted-foreground">
                  Used to deliver personalized advertisements.
                </p>
              </div>
              <Switch
                id="marketing"
                checked={preferences.marketing}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, marketing: checked })
                }
              />
            </div>

            {/* Preference Cookies */}
            <div className="flex items-start justify-between space-x-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="preferences" className="font-medium">
                  Preference Cookies
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remember your settings and preferences (language, theme, etc.).
                </p>
              </div>
              <Switch
                id="preferences"
                checked={preferences.preferences}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, preferences: checked })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCustomize(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustom}>Save Preferences</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
