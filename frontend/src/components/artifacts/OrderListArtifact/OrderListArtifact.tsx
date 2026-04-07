'use client'

/**
 * OrderListArtifact - Display order history list
 *
 * Tools that use this artifact:
 * - get_order_history
 *
 * Features:
 * - List view of user's orders
 * - Shows: order ID, date, status, total
 * - Action buttons per order: "Track Order", "View Details"
 * - Empty state when no orders
 * - Responsive: stacks on mobile
 */

import { Package, Calendar, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'

export interface OrderItem {
  id: string
  status: string
  totalCents: number
  currency: string
  createdAt: string
  paidAt?: string
  shippedAt?: string
}

interface OrderListArtifactProps {
  orders: OrderItem[]
  variant?: 'inline' | 'full'
}

export function OrderListArtifact({
  orders,
  variant = 'inline',
}: OrderListArtifactProps) {
  const t = useTranslations('storefront')
  const locale = useLocale()
  const router = useRouter()

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    paid: 'bg-success/10 text-success',
    processing: 'bg-primary/10 text-primary',
    shipped: 'bg-accent/10 text-accent-foreground',
    delivered: 'bg-success/10 text-success',
    cancelled: 'bg-destructive/10 text-destructive',
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-semibold text-foreground mb-2">{t('noOrdersTitle')}</p>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            {t('noOrdersDescription')}
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
          <Package className="h-5 w-5" />
          {t('orderHistory')} ({orders.length} {orders.length === 1 ? t('order') : t('orders')})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {orders.map((order, index) => (
          <div key={order.id}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Order Info */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-foreground">
                    Order #{order.id.substring(0, 8)}
                  </h3>
                  <Badge className={cn('text-xs', statusColors[order.status] || '')}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Banknote className="h-4 w-4" />
                    <span className="font-medium text-foreground">
                      {formatPrice(order.totalCents / 100, locale, order.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="neu-btn-soft"
                  onClick={() => router.push(`/${locale}/orders/${order.id}`)}
                >
                  {t('viewDetails')}
                </Button>
                {order.status !== 'cancelled' && (
                  <Button
                    variant="default"
                    size="sm"
                    className="neu-btn-accent"
                    onClick={() => {
                      router.push(`/${locale}/orders/${order.id}`)
                    }}
                  >
                    {t('trackOrder')}
                  </Button>
                )}
              </div>
            </div>

            {index < orders.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
