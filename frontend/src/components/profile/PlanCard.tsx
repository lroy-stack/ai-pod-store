'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2, CreditCard, Zap, Crown } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { apiFetch } from '@/lib/api-fetch'
import { UsageMeter } from '@/components/engagement/UsageMeter'

interface UsageData {
  tier: 'free' | 'premium'
  credit_balance: number
  subscription_status: string
  limits: {
    chats_per_day: number
    designs_per_month: number
    mockups_per_month: number
  }
}

export function PlanCard() {
  const t = useTranslations('Profile')
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/subscription/usage')
        if (res.ok) {
          const data = await res.json()
          setUsage(data)
        }
      } catch (error) {
        console.error('Failed to fetch plan usage:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUsage()
  }, [])

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const res = await apiFetch('/api/subscription/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
      })
      if (res.ok) {
        const { url } = await res.json()
        window.location.href = url
      } else {
        console.error('Failed to open subscription portal')
      }
    } catch (error) {
      console.error('Portal error:', error)
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{t('loadingPlan')}</span>
        </CardContent>
      </Card>
    )
  }

  if (!usage) return null

  const isPremium = usage.tier === 'premium'
  const isActive = usage.subscription_status === 'active'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {isPremium ? (
                <Crown className="h-5 w-5 text-primary" />
              ) : (
                <Zap className="h-5 w-5 text-muted-foreground" />
              )}
              {t('planTitle')}
            </CardTitle>
            <CardDescription>{t('planDescription')}</CardDescription>
          </div>
          <Badge variant={isPremium && isActive ? 'default' : 'secondary'}>
            {isPremium ? t('premiumPlan') : t('freePlan')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan limits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold">{usage.limits.chats_per_day}</div>
            <div className="text-xs text-muted-foreground mt-1">{t('chatsPerDay')}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold">{usage.limits.designs_per_month}</div>
            <div className="text-xs text-muted-foreground mt-1">{t('designsPerMonth')}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold">{usage.limits.mockups_per_month}</div>
            <div className="text-xs text-muted-foreground mt-1">{t('mockupsPerMonth')}</div>
          </div>
        </div>

        {/* Current usage bars */}
        <UsageMeter />

        {/* Credit balance (premium only) */}
        {isPremium && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('creditBalance')}</span>
              </div>
              <span className="text-sm font-bold">
                {t('credits', { count: usage.credit_balance })}
              </span>
            </div>
          </>
        )}

        <Separator />

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          {isPremium ? (
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('openingPortal')}
                </>
              ) : (
                t('manageSubscription')
              )}
            </Button>
          ) : (
            <Button asChild className="flex-1">
              <Link href={`/${locale}/pricing`}>
                <Crown className="mr-2 h-4 w-4" />
                {t('upgradeToPremium')}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
