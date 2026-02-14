'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { toast } from 'sonner'

// Maximum quantity allowed per cart item
const MAX_CART_QUANTITY = 99

export default function CartView({ locale }: { locale: string }) {
  const t = useTranslations('Cart')
  const { authenticated, loading: authLoading } = useAuth()
  const { items: cartItems, loading: cartLoading, refreshCart } = useCart()
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())

  const loading = authLoading || cartLoading
  const cartTotal = cartItems.reduce((total, item) => total + (item.product_price * item.quantity), 0)

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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
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
                        <Image
                          src={`https://via.placeholder.com/150`}
                          alt={item.product_title}
                          fill
                          className="object-cover"
                        />
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground mb-1 truncate">
                          {item.product_title}
                        </h3>

                        {/* Variant Details */}
                        {item.variant_details && (
                          <div className="flex gap-2 mb-2">
                            {item.variant_details.size && (
                              <Badge variant="secondary" className="text-xs">
                                Size: {item.variant_details.size}
                              </Badge>
                            )}
                            {item.variant_details.color && (
                              <Badge variant="secondary" className="text-xs">
                                Color: {item.variant_details.color}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Price */}
                        <p className="text-sm font-medium text-foreground mb-3">
                          ${item.product_price.toFixed(2)} each
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
                          Item total: ${(item.product_price * item.quantity).toFixed(2)}
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
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-foreground">{t('subtotal')}</span>
                    <span className="text-foreground font-medium">${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground">{t('shipping')}</span>
                    <span className="text-foreground font-medium">{t('calculated')}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-foreground">{t('total')}</span>
                  <span className="text-lg font-bold text-foreground">${cartTotal.toFixed(2)}</span>
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
