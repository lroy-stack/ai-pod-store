'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function CartView({ locale }: { locale: string }) {
  const t = useTranslations('Cart')
  const { authenticated, loading } = useAuth()

  const cartItems: any[] = []
  const cartTotal = 0

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
              <CardContent>
                <p className="text-foreground">{t('itemsInCart', { count: cartItems.length })}</p>
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
