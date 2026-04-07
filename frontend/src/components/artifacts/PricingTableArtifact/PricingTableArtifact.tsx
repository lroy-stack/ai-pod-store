'use client'

import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslations, useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { formatPrice } from '@/lib/currency'

export interface ShippingOption {
  method: string
  price: number
  days: string
  currency: string
}

export interface PricingTableArtifactProps {
  country: string
  options: ShippingOption[]
  freeShippingThreshold?: number
  message?: string
}

export function PricingTableArtifact({
  country,
  options,
  freeShippingThreshold,
  message,
}: PricingTableArtifactProps) {
  const t = useTranslations('Cart')
  const locale = useLocale()

  if (options.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 text-center text-muted-foreground">
          {t('noShippingOptions', { fallback: 'No shipping options available' })}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">{t('shippingOptions', { fallback: 'Shipping Options' })}</h3>
          <p className="text-sm text-muted-foreground">
            {t('shippingTo', { fallback: 'Shipping to' })}: {country}
          </p>
          {message && (
            <Badge variant="secondary" className="w-fit">
              {message}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {options.map((option, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50',
                'border-border'
              )}
            >
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{option.method}</span>
                  {index === 0 && (
                    <Badge variant="outline" className="text-xs">
                      {t('recommended', { fallback: 'Recommended' })}
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">{option.days}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-foreground">
                  {formatPrice(option.price, locale, option.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      {freeShippingThreshold && (
        <CardFooter className="flex-col items-start gap-2 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">
              {t('freeShippingOver', { fallback: 'Free shipping on orders over' })}{' '}
              <span className="font-semibold text-foreground">{formatPrice(freeShippingThreshold, locale, 'EUR')}</span>
            </span>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
