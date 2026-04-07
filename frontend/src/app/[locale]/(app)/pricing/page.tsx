'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, Crown, Zap, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api-fetch'
import { toast } from 'sonner'
import { useParams } from 'next/navigation'

const CREDIT_PACKS = [
  { id: 'small', credits: 15, price: '4.99', perCredit: '0.33' },
  { id: 'medium', credits: 50, price: '14.99', perCredit: '0.30', popular: true },
  { id: 'large', credits: 150, price: '39.99', perCredit: '0.27' },
]

export default function PricingPage() {
  const t = useTranslations('pricing')
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const params = useParams()
  const locale = params.locale as string
  const [loading, setLoading] = useState<string | null>(null)
  const [currentTier, setCurrentTier] = useState<'free' | 'premium' | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)

  const success = searchParams.get('success')
  const creditsSuccess = searchParams.get('credits')

  const TIERS = [
    {
      name: t('tierFreeName'),
      price: '0',
      period: '',
      description: t('tierFreeDesc'),
      features: [
        t('featureFreeChats'),
        t('featureFreeDesigns'),
        t('featureFreeMockups'),
        t('featureFreeWishlist'),
        t('featureFreeTracking'),
      ],
      cta: t('currentPlan'),
      ctaVariant: 'outline' as const,
      highlighted: false,
      key: 'free',
    },
    {
      name: t('tierPremiumName'),
      price: '9.99',
      period: t('perMonth'),
      description: t('tierPremiumDesc'),
      features: [
        t('featurePremiumChats'),
        t('featurePremiumDesigns'),
        t('featurePremiumMockups'),
        t('featurePremiumBonus'),
        t('featurePremiumSaves'),
        t('featurePremiumPriority'),
      ],
      cta: t('upgradeNow'),
      ctaVariant: 'default' as const,
      highlighted: true,
      key: 'premium',
    },
  ]

  // Fetch user's current subscription tier and status
  useEffect(() => {
    if (!user) {
      setCurrentTier(null)
      setSubscriptionStatus(null)
      return
    }

    async function fetchSubscription() {
      try {
        const res = await fetch('/api/subscription/usage')
        if (res.ok) {
          const data = await res.json()
          setCurrentTier(data.tier || 'free')
          setSubscriptionStatus(data.subscription_status || 'none')
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error)
        setCurrentTier('free') // Default to free on error
        setSubscriptionStatus('none')
      }
    }

    fetchSubscription()
  }, [user])

  async function handleSubscribe() {
    if (!user) {
      window.location.href = `/${locale}/auth/login`
      return
    }
    setLoading('subscription')
    try {
      const res = await apiFetch('/api/subscription/create', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || t('errorGeneric'))
      }
    } catch {
      toast.error(t('errorGeneric'))
    } finally {
      setLoading(null)
    }
  }

  async function handleBuyCredits(pack: string) {
    if (!user) {
      window.location.href = `/${locale}/auth/login`
      return
    }
    setLoading(pack)
    try {
      const res = await apiFetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack, locale }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || t('errorGeneric'))
      }
    } catch {
      toast.error(t('errorGeneric'))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Success messages */}
        {success === 'true' && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary">
            {t('welcomePremium')}
          </div>
        )}
        {creditsSuccess === 'success' && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary">
            {t('creditsAdded')}
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
          {/* Crypto acceptance badge */}
          {process.env.NEXT_PUBLIC_STRIPE_CRYPTO_ENABLED === 'true' && (
            <div className="mt-4 flex justify-center">
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {t('acceptsCrypto')}
              </Badge>
            </div>
          )}
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {TIERS.map((tier) => {
            const tierKey = tier.key as 'free' | 'premium'
            const isCurrentPlan = user && currentTier === tierKey && subscriptionStatus === 'active'
            const isPremiumUser = currentTier === 'premium' && subscriptionStatus === 'active'
            const isCancelled = subscriptionStatus === 'cancelled'

            // Determine CTA text and behavior
            let ctaText = tier.cta
            let ctaDisabled = false
            let ctaOnClick = tier.highlighted ? handleSubscribe : undefined

            if (isCurrentPlan) {
              ctaText = t('currentPlan')
              ctaDisabled = true
              ctaOnClick = undefined
            } else if (tierKey === 'free' && isPremiumUser) {
              // Active premium users can't downgrade via this button (use Billing Portal)
              ctaText = t('managePlan')
              ctaDisabled = false
              ctaOnClick = async () => {
                window.location.href = `/${locale}/settings/billing`
              }
            } else if (tierKey === 'premium' && isCancelled) {
              ctaText = t('reactivate')
              ctaDisabled = loading === 'subscription'
              ctaOnClick = handleSubscribe
            } else if (tierKey === 'premium') {
              ctaText = user ? t('upgradeNow') : t('signInToUpgrade')
              ctaDisabled = loading === 'subscription'
              ctaOnClick = handleSubscribe
            }

            return (
              <Card
                key={tier.key}
                className={cn(
                  'relative',
                  tier.highlighted && 'border-primary shadow-lg',
                  isCurrentPlan && 'border-primary/50'
                )}
              >
                {tier.highlighted && !isCurrentPlan && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary">
                    {t('mostPopular')}
                  </Badge>
                )}
                {isCurrentPlan && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t('activePlan')}
                  </Badge>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    {tier.highlighted ? (
                      <Crown className="h-5 w-5 text-primary" />
                    ) : (
                      <Zap className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h2 className="text-xl font-semibold text-foreground">{tier.name}</h2>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {tier.price === '0' ? t('free') : `\u20AC${tier.price}`}
                    </span>
                    {tier.period && (
                      <span className="text-muted-foreground text-sm">{tier.period}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 mb-6">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5 text-sm">
                        <Check className={cn(
                          'h-4 w-4 flex-shrink-0',
                          tier.highlighted || isCurrentPlan ? 'text-primary' : 'text-muted-foreground'
                        )} />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={isCurrentPlan ? 'outline' : tier.ctaVariant}
                    className="w-full"
                    disabled={ctaDisabled}
                    onClick={ctaOnClick}
                  >
                    {loading === 'subscription' && tierKey === 'premium' && !isCurrentPlan
                      ? t('redirecting')
                      : ctaText}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Credit Packs */}
        <Separator className="mb-10" />

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-1">{t('creditPacks')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('creditPacksDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {CREDIT_PACKS.map((pack) => (
            <Card
              key={pack.id}
              className={cn(
                'relative',
                pack.popular && 'border-primary'
              )}
            >
              {pack.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-xs">
                  {t('bestValue')}
                </Badge>
              )}
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-foreground mb-0.5">
                  {pack.credits}
                </p>
                <p className="text-xs text-muted-foreground mb-3">{t('credits')}</p>
                <p className="text-lg font-semibold text-foreground mb-0.5">
                  {'\u20AC'}{pack.price}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {'\u20AC'}{pack.perCredit}{t('perCredit')}
                </p>
                <Button
                  variant={pack.popular ? 'default' : 'outline'}
                  size="sm"
                  className="w-full"
                  disabled={loading === pack.id}
                  onClick={() => handleBuyCredits(pack.id)}
                >
                  {loading === pack.id ? t('redirecting') : t('buyCredits')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {!user && (
          <p className="text-center text-sm text-muted-foreground">
            {t('signInHint')}
          </p>
        )}
      </div>
    </div>
  )
}
