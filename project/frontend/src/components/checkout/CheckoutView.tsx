'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatPrice } from '@/lib/currency'

export default function CheckoutView({ locale }: { locale: string }) {
  const t = useTranslations('Checkout')
  const tCart = useTranslations('Cart')
  const { user } = useAuth()
  const { items: cartItems, loading } = useCart()

  // Get user's preferred currency, fallback to locale default
  const userCurrency = user?.currency || (locale === 'es' || locale === 'de' ? 'EUR' : 'USD')

  const cartTotal = cartItems.reduce((total, item) => total + (item.product_price * item.quantity), 0)
  const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0)

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-10 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <div className="size-20 md:size-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <ShoppingCart className="size-10 md:size-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t('emptyCart')}
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('emptyCartDescription')}
          </p>
          <Button asChild size="lg">
            <Link href={`/${locale}/shop`}>
              {t('continueShopping')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <Button variant="ghost" asChild className="mb-4 -ml-2">
          <Link href={`/${locale}/cart`}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Cart
          </Link>
        </Button>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
          {t('title')}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Content - Left Side (will be checkout form in future) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Checkout Form Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Payment and shipping information form will be implemented here.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary - Right Side */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-foreground">{t('orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items Count */}
              <div className="text-sm text-muted-foreground">
                {t('items', { count: itemCount })}
              </div>

              <Separator />

              {/* Cart Items */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative size-16 md:size-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <Image
                        src={item.product_image || 'https://via.placeholder.com/150'}
                        alt={item.product_name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-foreground line-clamp-1">
                        {item.product_name}
                      </h3>
                      {item.variant_name && (
                        <p className="text-xs text-muted-foreground">
                          {item.variant_name}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          Qty: {item.quantity}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {formatPrice(item.product_price * item.quantity, locale, userCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Price Summary */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{t('subtotal')}</span>
                  <span className="text-foreground font-medium">
                    {formatPrice(cartTotal, locale, userCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{t('shipping')}</span>
                  <span className="text-muted-foreground text-sm">
                    {t('calculatedAtNextStep')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{t('tax')}</span>
                  <span className="text-muted-foreground text-sm">
                    {t('calculatedAtNextStep')}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between">
                <span className="text-lg font-bold text-foreground">{t('total')}</span>
                <span className="text-lg font-bold text-foreground">
                  {formatPrice(cartTotal, locale, userCurrency)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
