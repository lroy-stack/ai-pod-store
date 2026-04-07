'use client'

/**
 * CartSummaryArtifact - Display shopping cart contents
 *
 * Tools that use this artifact:
 * - get_cart
 *
 * Features:
 * - InlineCompact: List of cart items with quantities and prices
 * - Shows subtotal and item count
 * - Action buttons: "View Full Cart", "Checkout"
 * - Responsive: stacks on mobile
 */

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/currency'

export interface CartItem {
  id: string
  productId: string
  title: string
  price: number
  currency?: string
  quantity: number
  subtotal: number
}

interface CartSummaryArtifactProps {
  items: CartItem[]
  itemCount: number
  subtotal: number
  currency?: string
  variant?: 'inline' | 'full'
}

export function CartSummaryArtifact({
  items,
  itemCount,
  subtotal,
  currency,
  variant = 'inline',
}: CartSummaryArtifactProps) {
  const t = useTranslations('storefront')
  const locale = useLocale()
  const router = useRouter()

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-semibold text-foreground mb-2">{t('emptyCartTitle')}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {t('emptyCartDescription')}
          </p>
          <Button className="neu-btn-accent" onClick={() => router.push(`/${locale}/shop`)}>
            {t('browseProducts')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          {t('shoppingCart')} ({itemCount} {itemCount === 1 ? t('item') : t('items')})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cart Items List */}
        {items.map((item, index) => (
          <div key={item.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-foreground line-clamp-2">
                  {item.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPrice(item.price, locale, item.currency || currency)} × {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-foreground whitespace-nowrap">
                  {formatPrice(item.subtotal, locale, item.currency || currency)}
                </p>
              </div>
            </div>
            {index < items.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </CardContent>
      <Separator />
      <CardFooter className="flex-col gap-4 pt-6">
        {/* Subtotal */}
        <div className="w-full flex items-center justify-between">
          <span className="text-base font-medium text-foreground">{t('subtotal')}</span>
          <span className="text-xl font-bold text-foreground">
            {formatPrice(subtotal, locale, currency)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 neu-btn-soft"
            onClick={() => router.push(`/${locale}/cart`)}
          >
            {t('viewFullCart')}
          </Button>
          <Button
            className="flex-1 neu-btn-accent"
            onClick={() => router.push(`/${locale}/checkout`)}
          >
            {t('proceedToCheckout')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {t('shippingTaxNote')}
        </p>
      </CardFooter>
    </Card>
  )
}
