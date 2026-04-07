'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatPrice } from '@/lib/currency'
import { STORE_DEFAULTS } from '@/lib/store-config'
import { Package, ShoppingBag, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

interface Order {
  id: string
  status: string
  total_cents: number
  currency: string
  created_at: string
  paid_at: string | null
  shipped_at: string | null
  tracking_number: string | null
  customer_email: string | null
}

export default function OrdersView({ locale }: { locale: string }) {
  const t = useTranslations('Orders')
  const { user, authenticated, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get user's preferred currency, fallback to locale default
  const userCurrency = user?.currency || STORE_DEFAULTS.currency

  useEffect(() => {
    if (!authLoading && authenticated) {
      fetchOrders()
    } else if (!authLoading && !authenticated) {
      setLoading(false)
    }
  }, [authenticated, authLoading])

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/orders')
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
      } else if (response.status === 401) {
        setError('unauthorized')
      } else {
        setError('failed')
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('failed')
    } finally {
      setLoading(false)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  // Get status badge variant
  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'paid':
      case 'submitted':
        return 'default'
      case 'in_production':
      case 'shipped':
      case 'delivered':
        return 'secondary'
      case 'cancelled':
      case 'refunded':
        return 'destructive'
      default:
        return 'default'
    }
  }

  // Get status label
  const getStatusLabel = (status: string): string => {
    return t(`status.${status}`)
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-10 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <div className="size-20 md:size-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <AlertCircle className="size-10 md:size-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t('loginRequired')}
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('loginRequiredDescription')}
          </p>
          <Button asChild size="lg">
            <Link href={`/${locale}/auth/login`}>
              {t('loginButton')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (error === 'unauthorized') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <div className="size-20 md:size-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <AlertCircle className="size-10 md:size-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t('unauthorized')}
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('unauthorizedDescription')}
          </p>
        </div>
      </div>
    )
  }

  if (error === 'failed') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <div className="size-20 md:size-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <AlertCircle className="size-10 md:size-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t('error')}
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('errorDescription')}
          </p>
          <Button onClick={fetchOrders} size="lg">
            {t('retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <div className="size-20 md:size-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <ShoppingBag className="size-10 md:size-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">
            {t('noOrders')}
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('noOrdersDescription')}
          </p>
          <Button asChild size="lg">
            <Link href={`/${locale}/shop`}>
              {t('startShopping')}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="size-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base md:text-lg">
                        {t('orderNumber', { number: order.id.substring(0, 8).toUpperCase() })}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(order.status)}>
                    {getStatusLabel(order.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Separator className="mb-4" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('total')}
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {formatPrice(order.total_cents / 100, locale, order.currency.toUpperCase())}
                    </p>
                  </div>
                  {order.tracking_number && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {t('tracking')}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {order.tracking_number}
                      </p>
                    </div>
                  )}
                  <Button variant="outline" asChild>
                    <Link href={`/${locale}/orders/${order.id}`}>
                      {t('viewDetails')}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
