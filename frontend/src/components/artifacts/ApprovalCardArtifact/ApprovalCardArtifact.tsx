'use client'

/**
 * ApprovalCardArtifact - Renders approval dialog for checkout
 *
 * Used by create_checkout tool with needsApproval: true
 * Displays cart summary and asks user to confirm proceeding to Stripe
 */

import { useTranslations, useLocale } from 'next-intl'
import { ShoppingCart, CreditCard, AlertCircle } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export interface ApprovalCardArtifactProps {
  variant?: 'inline' | 'detail'
  cartItems?: Array<{
    productId: string
    productName: string
    productPrice: number
    quantity: number
  }>
  subtotal?: number
  onApprove?: () => void
  onDeny?: () => void
}

export function ApprovalCardArtifact({
  variant = 'inline',
  cartItems = [],
  subtotal = 0,
  onApprove,
  onDeny,
}: ApprovalCardArtifactProps) {
  const t = useTranslations('storefront')
  const locale = useLocale()

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Card className={variant === 'inline' ? 'max-w-lg' : 'max-w-2xl mx-auto'}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{t('approvalTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t('approvalSubtitle')}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cart Summary */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <span>
              {t('itemsInCartCount', { count: itemCount })}
            </span>
          </div>

          <div className="space-y-2">
            {cartItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p className="font-medium text-foreground">
                  {formatPrice(item.productPrice * item.quantity, locale, 'EUR')}
                </p>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('subtotal')}</span>
            <span className="text-lg font-bold text-foreground">{formatPrice(subtotal, locale, 'EUR')}</span>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              {t('approvalNote')}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          onClick={onDeny}
          variant="outline"
          className="flex-1 neu-btn-soft"
          disabled={!onDeny}
        >
          {t('approvalDeny')}
        </Button>
        <Button
          onClick={onApprove}
          className="flex-1 bg-primary hover:bg-primary/90 neu-btn-accent"
          disabled={!onApprove}
        >
          {t('approvalApprove')}
        </Button>
      </CardFooter>
    </Card>
  )
}
