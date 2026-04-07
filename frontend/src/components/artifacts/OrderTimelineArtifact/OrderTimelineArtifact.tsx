'use client'

/**
 * OrderTimelineArtifact - Display order tracking timeline
 *
 * Tools that use this artifact:
 * - track_order
 *
 * Features:
 * - Timeline view of order status progression
 * - Shows: placed, paid, processing, shipped, delivered
 * - Tracking number (if available)
 * - Estimated delivery date
 * - Action button: "View Order Details"
 * - Responsive: stacks on mobile
 */

import { Package, CheckCircle, Truck, MapPin, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'

export interface OrderStatus {
  status: 'placed' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  timestamp: string
}

interface OrderTimelineArtifactProps {
  orderId: string
  status: string
  trackingNumber?: string
  estimatedDelivery?: string
  createdAt: string
  paidAt?: string
  shippedAt?: string
  deliveredAt?: string
  currency: string
  total: number
  variant?: 'inline' | 'full'
  showFooter?: boolean
}

export function OrderTimelineArtifact({
  orderId,
  status,
  trackingNumber,
  estimatedDelivery,
  createdAt,
  paidAt,
  shippedAt,
  deliveredAt,
  currency,
  total,
  variant = 'inline',
  showFooter = true,
}: OrderTimelineArtifactProps) {
  const t = useTranslations('storefront')
  const locale = useLocale()
  const router = useRouter()

  // Handle missing data gracefully
  if (!orderId || !status) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Unable to load order details.</p>
        </CardContent>
      </Card>
    )
  }

  // Build timeline events
  const timelineEvents = [
    {
      label: t('orderPlaced'),
      status: 'placed',
      timestamp: createdAt,
      icon: Package,
      completed: true,
    },
    {
      label: t('paymentConfirmed'),
      status: 'paid',
      timestamp: paidAt,
      icon: CheckCircle,
      completed: !!paidAt,
    },
    {
      label: t('processing'),
      status: 'processing',
      timestamp: status === 'processing' ? new Date().toISOString() : undefined,
      icon: Clock,
      completed: ['processing', 'shipped', 'delivered'].includes(status),
    },
    {
      label: t('shipped'),
      status: 'shipped',
      timestamp: shippedAt,
      icon: Truck,
      completed: !!shippedAt || status === 'delivered',
    },
    {
      label: t('delivered'),
      status: 'delivered',
      timestamp: deliveredAt,
      icon: MapPin,
      completed: !!deliveredAt,
    },
  ]

  const currentEventIndex = timelineEvents.findIndex((e) => !e.completed)
  const activeEventIndex = currentEventIndex === -1 ? timelineEvents.length - 1 : currentEventIndex

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return null
    const date = new Date(timestamp)
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <Package className="h-5 w-5" />
          <span className="text-base sm:text-lg">Order #{orderId.substring(0, 8)}</span>
          <Badge className={cn('text-xs', statusColors[status] || '')}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Total: {formatPrice(total / 100, locale, currency)}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Timeline */}
        <div className="space-y-4">
          {timelineEvents.map((event, index) => {
            const Icon = event.icon
            const isActive = index === activeEventIndex
            const isCompleted = event.completed
            const isLast = index === timelineEvents.length - 1

            return (
              <div key={event.status} className="flex gap-4">
                {/* Icon + Line */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center border-2',
                      isCompleted
                        ? 'bg-primary border-primary text-primary-foreground'
                        : isActive
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-muted border-border text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        'w-0.5 flex-1 min-h-[40px]',
                        isCompleted ? 'bg-primary' : 'bg-border'
                      )}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-8">
                  <h3
                    className={cn(
                      'font-medium',
                      isCompleted || isActive ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {event.label}
                  </h3>
                  {event.timestamp && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(event.timestamp)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Tracking Number */}
        {trackingNumber && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-1">{t('trackingNumber')}</h4>
              <p className="text-sm text-muted-foreground font-mono">{trackingNumber}</p>
            </div>
          </>
        )}

        {/* Estimated Delivery */}
        {estimatedDelivery && status !== 'delivered' && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-1">{t('estimatedDelivery')}</h4>
              <p className="text-sm text-muted-foreground">
                {formatDate(estimatedDelivery)}
              </p>
            </div>
          </>
        )}
      </CardContent>

      {showFooter && <CardFooter className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          className="w-full sm:w-auto neu-btn-soft"
          onClick={() => router.push(`/${locale}/orders/${orderId}`)}
        >
          {t('viewOrderDetails')}
        </Button>
        {trackingNumber && (
          <Button
            variant="default"
            className="w-full sm:w-auto neu-btn-accent"
            onClick={() => {
              // In a real app, this would link to carrier tracking page
              window.open(`https://www.google.com/search?q=track+${trackingNumber}`, '_blank')
            }}
          >
            {t('trackPackage')}
          </Button>
        )}
      </CardFooter>}
    </Card>
  )
}
