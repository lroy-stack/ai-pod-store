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

import { Package, Calendar, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
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

  const formatPrice = (cents: number, curr: string) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr.toUpperCase(),
    }).format(cents / 100)
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    paid: 'bg-green-500/10 text-green-700 dark:text-green-400',
    processing: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    shipped: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    delivered: 'bg-green-500/10 text-green-700 dark:text-green-400',
    cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400',
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-semibold text-foreground mb-2">No orders yet</p>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            You haven't placed any orders yet. Start shopping to see your order history!
          </p>
          <Button onClick={() => router.push(`/${locale}/shop`)}>
            Browse Products
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
          Order History ({orders.length} {orders.length === 1 ? 'order' : 'orders'})
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
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium text-foreground">
                      {formatPrice(order.totalCents, order.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/${locale}/orders/${order.id}`)}
                >
                  View Details
                </Button>
                {order.status !== 'cancelled' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      // Trigger track_order in chat (would need chat context)
                      // For now, navigate to order details
                      router.push(`/${locale}/orders/${order.id}`)
                    }}
                  >
                    Track Order
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
