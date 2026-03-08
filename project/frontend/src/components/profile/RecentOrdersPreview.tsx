'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Package, ShoppingBag, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface OrderPreview {
  id: string
  created_at: string
  status: string
  total_cents: number
  currency: string
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'completed':
    case 'delivered':
      return 'default' as const
    case 'processing':
    case 'in_production':
      return 'secondary' as const
    case 'cancelled':
    case 'refunded':
      return 'destructive' as const
    default:
      return 'outline' as const
  }
}

export function RecentOrdersPreview() {
  const t = useTranslations('Profile')
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const [orders, setOrders] = useState<OrderPreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch('/api/orders?limit=3')
        if (res.ok) {
          const data = await res.json()
          setOrders(data.orders || [])
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            {t('recentOrders')}
          </CardTitle>
          {orders.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${locale}/orders`}>{t('viewAllOrders')}</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('noRecentOrders')}</p>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${locale}/shop`}>{t('startShopping')}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/${locale}/orders/${order.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    #{order.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString(locale, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(order.status)}>
                    {order.status.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-sm font-medium whitespace-nowrap">
                    {new Intl.NumberFormat(locale, {
                      style: 'currency',
                      currency: order.currency || 'EUR',
                    }).format(order.total_cents / 100)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
