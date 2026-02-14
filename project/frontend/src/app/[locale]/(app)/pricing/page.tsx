'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, Sparkles, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const TIERS = [
  {
    name: 'Free',
    price: '0',
    period: '',
    description: 'Get started with AI-powered shopping',
    features: [
      '50 AI chats per day',
      '3 AI designs per day',
      '5 product mockups per day',
      'Save wishlists',
      'Order tracking',
    ],
    cta: 'Current Plan',
    ctaVariant: 'outline' as const,
    highlighted: false,
  },
  {
    name: 'Premium',
    price: '9.99',
    period: '/mo',
    description: 'Unlimited creativity for power users',
    features: [
      '500 AI chats per day',
      '30 AI designs per day',
      '50 product mockups per day',
      '10 bonus credits per month',
      'Unlimited design saves',
      'Priority support',
    ],
    cta: 'Upgrade Now',
    ctaVariant: 'default' as const,
    highlighted: true,
  },
]

const CREDIT_PACKS = [
  { id: 'small', credits: 15, price: '4.99', perCredit: '0.33' },
  { id: 'medium', credits: 50, price: '14.99', perCredit: '0.30', popular: true },
  { id: 'large', credits: 150, price: '39.99', perCredit: '0.27' },
]

export default function PricingPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)

  const success = searchParams.get('success')
  const creditsSuccess = searchParams.get('credits')

  async function handleSubscribe() {
    if (!user) return
    setLoading('subscription')
    try {
      const res = await fetch('/api/subscription/create', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  async function handleBuyCredits(pack: string) {
    if (!user) return
    setLoading(pack)
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Success messages */}
        {success === 'true' && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary">
            Welcome to Premium! Your subscription is now active.
          </div>
        )}
        {creditsSuccess === 'success' && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary">
            Credits added to your account successfully!
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Choose your plan</h1>
          <p className="text-muted-foreground">
            Start free, upgrade when you need more
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {TIERS.map((tier) => (
            <Card
              key={tier.name}
              className={cn(
                'relative',
                tier.highlighted && 'border-primary shadow-lg'
              )}
            >
              {tier.highlighted && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  {tier.highlighted ? (
                    <Sparkles className="h-5 w-5 text-primary" />
                  ) : (
                    <Zap className="h-5 w-5 text-muted-foreground" />
                  )}
                  <h2 className="text-xl font-semibold text-foreground">{tier.name}</h2>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    {tier.price === '0' ? 'Free' : `\u20AC${tier.price}`}
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
                        tier.highlighted ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.ctaVariant}
                  className="w-full"
                  disabled={
                    (!user && tier.highlighted) ||
                    loading === 'subscription' ||
                    (!tier.highlighted)
                  }
                  onClick={tier.highlighted ? handleSubscribe : undefined}
                >
                  {loading === 'subscription' && tier.highlighted
                    ? 'Redirecting...'
                    : tier.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Credit Packs */}
        <Separator className="mb-10" />

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-1">Credit Packs</h2>
          <p className="text-sm text-muted-foreground">
            Need more designs? Buy credits anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
                  Best Value
                </Badge>
              )}
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-foreground mb-0.5">
                  {pack.credits}
                </p>
                <p className="text-xs text-muted-foreground mb-3">credits</p>
                <p className="text-lg font-semibold text-foreground mb-0.5">
                  {'\u20AC'}{pack.price}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {'\u20AC'}{pack.perCredit}/credit
                </p>
                <Button
                  variant={pack.popular ? 'default' : 'outline'}
                  size="sm"
                  className="w-full"
                  disabled={!user || loading === pack.id}
                  onClick={() => handleBuyCredits(pack.id)}
                >
                  {loading === pack.id ? 'Redirecting...' : 'Buy Credits'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {!user && (
          <p className="text-center text-sm text-muted-foreground">
            Please sign in to purchase a subscription or credits.
          </p>
        )}
      </div>
    </div>
  )
}
