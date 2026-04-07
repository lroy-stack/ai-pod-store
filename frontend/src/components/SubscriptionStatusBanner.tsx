'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { AlertCircle, X } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const DISMISSED_KEY = 'subscription-banner-dismissed'

export function SubscriptionStatusBanner() {
  const { user, authenticated } = useAuth()
  const params = useParams()
  const locale = params.locale as string
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if banner was dismissed (reset daily)
    const dismissedData = localStorage.getItem(DISMISSED_KEY)
    if (dismissedData) {
      try {
        const { timestamp } = JSON.parse(dismissedData)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
        if (timestamp > oneDayAgo) {
          setIsDismissed(true)
          setLoading(false)
          return
        }
      } catch (e) {
        // Invalid data, continue to fetch
      }
    }

    if (!authenticated || !user) {
      setLoading(false)
      return
    }

    // Fetch subscription status
    async function fetchStatus() {
      try {
        const res = await fetch('/api/subscription/usage')
        if (res.ok) {
          const data = await res.json()
          setSubscriptionStatus(data.subscription_status || null)
        }
      } catch (error) {
        console.error('Failed to fetch subscription status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [authenticated, user])

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify({ timestamp: Date.now() })
    )
  }

  // Don't show if loading, dismissed, not authenticated, or status is not past_due
  if (loading || isDismissed || !authenticated || subscriptionStatus !== 'past_due') {
    return null
  }

  return (
    <div className="border-b border-border bg-warning/10">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">
              <strong>Payment Required:</strong> Your subscription payment failed. Please update your payment method to continue using Premium features.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/${locale}/profile?tab=orders`}>
              <Button variant="outline" size="sm" className="whitespace-nowrap">
                Update Payment
              </Button>
            </Link>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
