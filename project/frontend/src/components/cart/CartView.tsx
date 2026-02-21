'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Minus, Plus, Trash2, ChevronDown, ChevronUp, Paintbrush } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/currency'
import { STORE_DEFAULTS, LOCALE_COUNTRY } from '@/lib/store-config'

const MAX_CART_QUANTITY = STORE_DEFAULTS.maxCartQuantity

export default function CartView({ locale }: { locale: string }) {
  const t = useTranslations('Cart')
  const { authenticated, loading: authLoading, user } = useAuth()
  const { items: cartItems, loading: cartLoading, refreshCart } = useCart()

  // Get user's preferred currency from cart items or locale default
  const userCurrency = user?.currency || (cartItems[0]?.product_currency) || STORE_DEFAULTS.currency
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discount_amount: number
    new_total: number
  } | null>(null)
  const [applyingCoupon, setApplyingCoupon] = useState(false)
  const [zipCode, setZipCode] = useState('')
  const [shippingEstimate, setShippingEstimate] = useState<{
    cost: number
    isFree: boolean
    freeShippingThreshold?: number
    estimatedDaysMin: number
    estimatedDaysMax: number
  } | null>(null)
  const [calculatingShipping, setCalculatingShipping] = useState(false)

  const loading = authLoading || cartLoading
  const cartTotal = cartItems.reduce((total, item) => total + (item.product_price * item.quantity), 0)
  const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0)
  const discountedTotal = appliedCoupon ? appliedCoupon.new_total : cartTotal
  const shippingCost = shippingEstimate?.cost || 0
  const finalTotal = discountedTotal + shippingCost

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    // Enforce maximum quantity on client side
    if (newQuantity > MAX_CART_QUANTITY) {
      toast.error(t('maxQuantityExceeded', { max: MAX_CART_QUANTITY }))
      return
    }

    setUpdatingItems(prev => new Set(prev).add(itemId))

    try {
      const response = await fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity: newQuantity }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update quantity')
      }

      await refreshCart()

      if (newQuantity === 0) {
        toast.success(t('itemRemoved'))
      } else {
        toast.success(t('quantityUpdated'))
      }
    } catch (error) {
      console.error('Update quantity error:', error)
      toast.error(error instanceof Error ? error.message : t('updateFailed'))
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error(t('couponInvalid'))
      return
    }

    setApplyingCoupon(true)

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), cartTotal }),
      })

      const data = await response.json()

      if (!response.ok || !data.valid) {
        toast.error(data.error || t('couponInvalid'))
        return
      }

      setAppliedCoupon({
        code: data.coupon.code,
        discount_amount: data.discount_amount,
        new_total: data.new_total,
      })
      toast.success(t('couponApplied'))
    } catch (error) {
      console.error('Coupon application error:', error)
      toast.error(t('couponInvalid'))
    } finally {
      setApplyingCoupon(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    toast.success(t('itemRemoved'))
  }

  const calculateShipping = async () => {
    if (!zipCode.trim()) {
      toast.error(t('zipCodeRequired'))
      return
    }

    setCalculatingShipping(true)

    try {
      const response = await fetch('/api/cart/shipping-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipCode: zipCode.trim(),
          countryCode: LOCALE_COUNTRY[locale] || STORE_DEFAULTS.country,
          cartTotal: discountedTotal,
          itemCount,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        toast.error(data.error || t('shippingCalculationFailed'))
        return
      }

      setShippingEstimate(data.shipping)
      toast.success(t('shippingCalculated'))
    } catch (error) {
      console.error('Shipping calculation error:', error)
      toast.error(t('shippingCalculationFailed'))
    } finally {
      setCalculatingShipping(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8">{t('title')}</h1>

      {cartItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">{t('emptyCart')}</p>
            <Button asChild>
              <Link href={`/${locale}/shop`}>
                {t('continueShopping')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('itemsInCart', { count: cartItems.length })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id}>
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="relative size-24 md:size-32 rounded-lg overflow-hidden bg-muted shrink-0">
                        {item.product_image ? (
                          <Image
                            src={item.product_image}
                            alt={item.product_title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs text-center p-2">
                            {item.product_title}
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground mb-1 truncate">
                          {item.product_title}
                        </h3>

                        {/* Variant Details and Personalization Badge */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          {item.variant_details?.size && (
                            <Badge variant="secondary" className="text-xs">
                              Size: {item.variant_details.size}
                            </Badge>
                          )}
                          {item.variant_details?.color && (
                            <Badge variant="secondary" className="text-xs">
                              Color: {item.variant_details.color}
                            </Badge>
                          )}
                          {item.personalization && (
                            <Badge variant="default" className="text-xs gap-1">
                              <Paintbrush className="size-3" />
                              Personalized
                            </Badge>
                          )}
                        </div>

                        {/* Personalization Details (expandable) */}
                        {item.personalization && (
                          <div className="mb-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => toggleExpanded(item.id)}
                            >
                              {expandedItems.has(item.id) ? (
                                <>
                                  <ChevronUp className="size-3" />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="size-3" />
                                  Show Details
                                </>
                              )}
                            </Button>

                            {expandedItems.has(item.id) && (
                              <div className="mt-2 p-3 bg-muted/30 rounded-md border border-border space-y-1.5 text-xs">
                                <div>
                                  <span className="font-medium text-muted-foreground">Text:</span>{' '}
                                  <span className="text-foreground">{item.personalization.text}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-muted-foreground">Font:</span>{' '}
                                  <span className="text-foreground" style={{ fontFamily: item.personalization.font }}>
                                    {item.personalization.font}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-muted-foreground">Color:</span>
                                  <div
                                    className="size-4 rounded border border-border"
                                    style={{ backgroundColor: item.personalization.fontColor }}
                                  />
                                  <span className="text-foreground font-mono">{item.personalization.fontColor}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-muted-foreground">Size:</span>{' '}
                                  <span className="text-foreground capitalize">{item.personalization.fontSize}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-muted-foreground">Position:</span>{' '}
                                  <span className="text-foreground capitalize">{item.personalization.position}</span>
                                </div>
                                {item.personalization.surcharge && item.personalization.surcharge > 0 && (
                                  <div className="mt-2 pt-2 border-t border-border">
                                    <span className="font-medium text-muted-foreground">Personalization fee:</span>{' '}
                                    <span className="text-foreground">+€{item.personalization.surcharge.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Price */}
                        <p className="text-sm font-medium text-foreground mb-3">
                          {formatPrice(item.product_price, locale, userCurrency)} each
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8"
                              onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                              disabled={updatingItems.has(item.id)}
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="w-12 text-center font-medium text-foreground">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={updatingItems.has(item.id) || item.quantity >= MAX_CART_QUANTITY}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => updateQuantity(item.id, 0)}
                            disabled={updatingItems.has(item.id)}
                          >
                            <Trash2 className="size-4 mr-1" />
                            {t('remove')}
                          </Button>
                        </div>

                        {/* Item Total */}
                        <p className="text-sm font-semibold text-foreground mt-2">
                          Item total: {formatPrice(item.product_price * item.quantity, locale, userCurrency)}
                        </p>
                      </div>
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>{t('orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coupon Code Input */}
                {!appliedCoupon ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t('couponCode')}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder={t('couponPlaceholder')}
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                        disabled={applyingCoupon}
                        className="flex-1"
                      />
                      <Button
                        onClick={applyCoupon}
                        disabled={applyingCoupon || !couponCode.trim()}
                        size="default"
                      >
                        {applyingCoupon ? t('applying') : t('applyCoupon')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20">
                      <div>
                        <p className="text-sm font-medium text-success">
                          {t('couponCode')}: {appliedCoupon.code}
                        </p>
                        <p className="text-xs text-success/80">
                          -{formatPrice(appliedCoupon.discount_amount, locale, userCurrency)} {t('discount')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeCoupon}
                        className="text-success hover:text-success"
                      >
                        {t('removeCoupon')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Shipping Estimate */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t('shippingEstimate')}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder={t('zipCodePlaceholder')}
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && calculateShipping()}
                      disabled={calculatingShipping}
                      className="flex-1"
                      maxLength={10}
                    />
                    <Button
                      onClick={calculateShipping}
                      disabled={calculatingShipping || !zipCode.trim()}
                      size="default"
                    >
                      {calculatingShipping ? t('calculating') : t('calculate')}
                    </Button>
                  </div>
                  {shippingEstimate && (
                    <div className="p-3 bg-muted rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {shippingEstimate.isFree ? t('freeShipping') : t('shippingCost')}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {shippingEstimate.isFree ? t('free') : formatPrice(shippingEstimate.cost, locale, userCurrency)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('estimatedDelivery', {
                          min: shippingEstimate.estimatedDaysMin,
                          max: shippingEstimate.estimatedDaysMax,
                        })}
                      </p>
                      {!shippingEstimate.isFree && shippingEstimate.freeShippingThreshold && discountedTotal < shippingEstimate.freeShippingThreshold && (
                        <p className="text-xs text-primary mt-1">
                          {t('freeShippingThreshold', {
                            amount: shippingEstimate.freeShippingThreshold.toFixed(2),
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-foreground">{t('subtotal')}</span>
                    <span className="text-foreground font-medium">{formatPrice(cartTotal, locale, userCurrency)}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between text-success">
                      <span>{t('discount')}</span>
                      <span className="font-medium">-{formatPrice(appliedCoupon.discount_amount, locale, userCurrency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-foreground">{t('shipping')}</span>
                    <span className="text-foreground font-medium">
                      {shippingEstimate
                        ? shippingEstimate.isFree
                          ? t('free')
                          : formatPrice(shippingEstimate.cost, locale, userCurrency)
                        : t('calculated')}
                    </span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-foreground">{t('total')}</span>
                  <span className="text-lg font-bold text-foreground">{formatPrice(finalTotal, locale, userCurrency)}</span>
                </div>

                <div className="space-y-3 pt-2">
                  {authenticated ? (
                    <Button asChild className="w-full">
                      <Link href={`/${locale}/checkout`}>
                        {t('proceedToCheckout')}
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild className="w-full">
                        <Link href={`/${locale}/checkout?guest=true`}>
                          {t('guestCheckout')}
                        </Link>
                      </Button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <Separator />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="bg-card px-2 text-muted-foreground">{t('or')}</span>
                        </div>
                      </div>

                      <Button asChild variant="outline" className="w-full">
                        <Link href={`/${locale}/auth/login?returnUrl=/${locale}/checkout`}>
                          {t('signInToCheckout')}
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
