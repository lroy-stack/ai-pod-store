'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Minus, Plus, Trash2, Pencil, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/currency'
import { STORE_DEFAULTS, LOCALE_COUNTRY } from '@/lib/store-config'
import { CartCrossSell } from '@/components/cart/CartCrossSell'
import { apiFetch } from '@/lib/api-fetch'

const MAX_CART_QUANTITY = STORE_DEFAULTS.maxCartQuantity

export default function CartView({ locale }: { locale: string }) {
  const t = useTranslations('Cart')
  const { authenticated, loading: authLoading, user } = useAuth()
  const { items: cartItems, loading: cartLoading, refreshCart, updateQuantity: hookUpdateQuantity, updateVariant, availableVariants } = useCart()

  // Get user's preferred currency from cart items or locale default
  const userCurrency = user?.currency || (cartItems[0]?.product_currency) || STORE_DEFAULTS.currency
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editSize, setEditSize] = useState<string>('')
  const [editColor, setEditColor] = useState<string>('')
  const [savingVariant, setSavingVariant] = useState(false)
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())

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

  // Restore coupon from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('pod_applied_coupon')
      if (saved) {
        const parsed = JSON.parse(saved)
        setAppliedCoupon(parsed)
        setCouponCode(parsed.code)
      }
    } catch { /* ignore */ }
  }, [])

  const loading = authLoading || cartLoading
  const availableItems = cartItems.filter((item: any) => !item.unavailable)
  const cartTotal = availableItems.reduce((total, item) => total + (item.product_price * item.quantity), 0)
  const itemCount = availableItems.reduce((count, item) => count + item.quantity, 0)
  const discountedTotal = appliedCoupon ? appliedCoupon.new_total : cartTotal
  const isFreeShipping = discountedTotal >= STORE_DEFAULTS.freeShippingThreshold
  const shippingCost = isFreeShipping ? 0 : 4.99
  const finalTotal = discountedTotal + shippingCost

  const startEditing = (item: any) => {
    setEditingItemId(item.id)
    setEditSize(item.variant_details?.size || '')
    setEditColor(item.variant_details?.color || '')
  }

  const cancelEditing = () => {
    setEditingItemId(null)
    setEditSize('')
    setEditColor('')
  }

  const saveVariant = async (itemId: string) => {
    setSavingVariant(true)
    try {
      const variant: { size?: string; color?: string } = {}
      if (editSize) variant.size = editSize
      if (editColor) variant.color = editColor
      await updateVariant(itemId, variant)
      toast.success(t('variantUpdated'))
      setEditingItemId(null)
    } catch { /* non-critical */
      // error already toasted by updateVariant
    } finally {
      setSavingVariant(false)
    }
  }

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity > MAX_CART_QUANTITY) {
      toast.error(t('maxQuantityExceeded', { max: MAX_CART_QUANTITY }))
      return
    }

    const removedItem = newQuantity === 0 ? cartItems.find((i: any) => i.id === itemId) : null

    setUpdatingItems(prev => new Set(prev).add(itemId))

    try {
      await hookUpdateQuantity(itemId, newQuantity)

      if (newQuantity === 0 && removedItem) {
        toast.success(t('itemRemoved'), {
          action: {
            label: t('undoRemove'),
            onClick: async () => {
              try {
                await apiFetch('/api/cart', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    product_id: removedItem.product_id,
                    quantity: removedItem.quantity,
                    variant: removedItem.variant_details,
                  }),
                })
                await refreshCart()
              } catch { /* ignore */ }
            },
          },
        })
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
      const response = await apiFetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), cartTotal, userId: user?.id || null }),
      })

      const data = await response.json()

      if (!response.ok || !data.valid) {
        toast.error(data.error || t('couponInvalid'))
        return
      }

      const couponData = {
        code: data.coupon.code,
        discount_amount: data.discount_amount,
        new_total: data.new_total,
      }
      setAppliedCoupon(couponData)
      // Persist to sessionStorage for checkout
      try {
        sessionStorage.setItem('pod_applied_coupon', JSON.stringify(couponData))
      } catch { /* ignore */ }
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
    try { sessionStorage.removeItem('pod_applied_coupon') } catch { /* ignore */ }
    toast.success(t('itemRemoved'))
  }

  const calculateShipping = async () => {
    if (!zipCode.trim()) {
      toast.error(t('zipCodeRequired'))
      return
    }

    setCalculatingShipping(true)

    try {
      const response = await apiFetch('/api/cart/shipping-estimate', {
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('itemsInCart', { count: cartItems.length })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id}>
                    <div className="flex gap-3 md:gap-4">
                      {/* Product Image */}
                      <Link href={`/${locale}/shop/${item.product_slug || item.product_id}`} className="hover:opacity-80 transition-opacity">
                        <div className="relative size-20 md:size-32 rounded-lg overflow-hidden bg-muted shrink-0">
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
                      </Link>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/${locale}/shop/${item.product_slug || item.product_id}`} className="hover:opacity-80 transition-opacity">
                          <h3 className="font-medium text-foreground mb-1 truncate">
                            {item.product_title}
                          </h3>
                        </Link>

                        {/* Variant Details and Personalization Badge */}
                        {editingItemId === item.id ? (
                          <div className="flex flex-col gap-2 mb-2">
                            <div className="flex flex-wrap gap-2">
                              {availableVariants[item.product_id]?.sizes?.length > 0 && (
                                <Select value={editSize} onValueChange={setEditSize}>
                                  <SelectTrigger className="w-32 h-9">
                                    <SelectValue placeholder={t('sizePlaceholder')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableVariants[item.product_id].sizes.map((s) => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {availableVariants[item.product_id]?.colors?.length > 0 && (
                                <Select value={editColor} onValueChange={setEditColor}>
                                  <SelectTrigger className="w-32 h-9">
                                    <SelectValue placeholder={t('colorPlaceholder')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableVariants[item.product_id].colors.map((c) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => saveVariant(item.id)}
                                disabled={savingVariant}
                              >
                                {savingVariant ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                                {t('saveVariant')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                onClick={cancelEditing}
                                disabled={savingVariant}
                              >
                                {t('cancelEdit')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {item.variant_details?.size && (
                              <Badge variant="secondary" className="text-xs">
                                {t('variantSize')}: {item.variant_details.size}
                              </Badge>
                            )}
                            {item.variant_details?.color && (
                              <Badge variant="secondary" className="text-xs">
                                {t('variantColor')}: {item.variant_details.color}
                              </Badge>
                            )}
                            {(item.variant_details?.size || item.variant_details?.color) && availableVariants[item.product_id] && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => startEditing(item)}
                                title={t('editVariant')}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                            {item.unavailable && (
                              <Badge variant="destructive" className="text-xs">
                                {t('unavailable')}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Price */}
                        <p className="text-sm font-medium text-foreground mb-3">
                          {formatPrice(item.product_price, locale, userCurrency)} {t('priceEach')}
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 md:gap-4">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8"
                              onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                              disabled={updatingItems.has(item.id)}
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="w-8 md:w-12 text-center font-medium text-foreground">
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
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive md:w-auto md:h-auto md:px-3 md:py-1.5"
                            onClick={() => updateQuantity(item.id, 0)}
                            disabled={updatingItems.has(item.id)}
                            aria-label={t('remove')}
                          >
                            <Trash2 className="size-4 md:mr-1" />
                            <span className="hidden md:inline">{t('remove')}</span>
                          </Button>
                        </div>

                        {/* Item Total */}
                        <p className="text-sm font-semibold text-foreground mt-2">
                          {t('itemTotal')}: {formatPrice(item.product_price * item.quantity, locale, userCurrency)}
                        </p>
                      </div>
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {cartItems.length > 0 && (
              <CartCrossSell productId={cartItems[0].product_id} />
            )}
          </div>

          <div className="lg:col-span-1">
            <Card>
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

                {/* Free Shipping Progress */}
                {(() => {
                  const threshold = STORE_DEFAULTS.freeShippingThreshold
                  const progress = Math.min((discountedTotal / threshold) * 100, 100)
                  const remaining = threshold - discountedTotal
                  if (isFreeShipping) {
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-success text-sm">
                          <Check className="size-4" />
                          <span>{t('freeShippingUnlocked')}</span>
                        </div>
                        <Progress value={100} className="h-2" />
                      </div>
                    )
                  }
                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-primary font-medium">
                        {t('freeShippingThresholdWithPrice', {
                          shippingPrice: formatPrice(4.99, locale, userCurrency),
                          amount: formatPrice(remaining, locale, userCurrency),
                        })}
                      </p>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )
                })()}

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
                    <span className={`font-medium ${isFreeShipping ? 'text-success' : 'text-foreground'}`}>
                      {isFreeShipping ? t('free') : formatPrice(4.99, locale, userCurrency)}
                    </span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-foreground">{t('total')}</span>
                  <span className="text-lg font-bold text-foreground">{formatPrice(finalTotal, locale, userCurrency)}</span>
                </div>

                {/* Crypto acceptance badge */}
                {process.env.NEXT_PUBLIC_STRIPE_CRYPTO_ENABLED === 'true' && (
                  <div className="flex justify-center pt-2">
                    <Badge variant="outline" className="gap-1.5 px-2.5 py-0.5 text-xs">
                      <svg
                        className="h-3 w-3"
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
