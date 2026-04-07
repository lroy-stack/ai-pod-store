'use client'

/**
 * Tenant Billing & Usage Dashboard
 *
 * Shows per-tenant billing info: plan, Stripe Connect status,
 * usage metrics (products, orders), and platform fee configuration.
 *
 * Route: /panel/tenants/[id]
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminFetch } from '@/lib/admin-api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Building2, CreditCard, Package, ShoppingBag,
  ExternalLink, AlertCircle, CheckCircle2, RefreshCw,
} from 'lucide-react'

interface TenantBillingData {
  tenant: {
    id: string
    name: string
    slug: string
    plan: string
    status: string
    domain: string | null
    created_at: string
  }
  billing: {
    stripe_connected_account_id: string | null
    platform_fee_rate: number
    platform_fee_percent: string
  }
  usage: {
    product_count: number
    orders_this_month: number
    revenue_this_month: number
    revenue_this_month_formatted: string
  }
  limits: {
    max_products: number | null
    max_orders_per_month: number | null
    custom_domain_allowed: boolean
    products_used_pct: number
    orders_used_pct: number
  }
}

const PLAN_COLORS: Record<string, string> = {
  free: 'secondary',
  starter: 'default',
  pro: 'default',
  enterprise: 'default',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export default function TenantBillingPage() {
  const params = useParams()
  const tenantId = params.id as string
  const [data, setData] = useState<TenantBillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/tenants/${tenantId}/billing`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tenant billing')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error ?? 'Tenant not found'}</span>
        </div>
      </div>
    )
  }

  const { tenant, billing, usage, limits } = data

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
              {tenant.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            slug: {tenant.slug}
            {tenant.domain && ` · ${tenant.domain}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Plan Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold capitalize">
                {PLAN_LABELS[tenant.plan] ?? tenant.plan}
              </span>
              <Badge
                variant={(PLAN_COLORS[tenant.plan] ?? 'secondary') as 'default' | 'secondary'}
                className="text-xs"
              >
                {billing.platform_fee_percent} platform fee
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Max products</span>
                <span className="font-medium">{limits.max_products ?? 'Unlimited'}</span>
              </div>
              <div className="flex justify-between">
                <span>Max orders/month</span>
                <span className="font-medium">{limits.max_orders_per_month ?? 'Unlimited'}</span>
              </div>
              <div className="flex justify-between">
                <span>Custom domain</span>
                <span className="font-medium">{limits.custom_domain_allowed ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Connect Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Stripe Connect
            </CardTitle>
            <CardDescription className="text-xs">
              Payments route to tenant&apos;s connected account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {billing.stripe_connected_account_id ? (
              <>
                <div className="flex items-center gap-2 text-sm text-success dark:text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Connected</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {billing.stripe_connected_account_id}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() =>
                    window.open(
                      `https://dashboard.stripe.com/connect/accounts/${billing.stripe_connected_account_id}`,
                      '_blank'
                    )
                  }
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open in Stripe Dashboard
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>No connected account — payments go to platform</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Usage This Month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Products */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Package className="h-3 w-3" />
                  Products
                </span>
                <span className="font-medium">
                  {usage.product_count}
                  {limits.max_products && ` / ${limits.max_products}`}
                </span>
              </div>
              {limits.max_products && (
                <Progress value={limits.products_used_pct} className="h-1.5" />
              )}
            </div>

            {/* Orders */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <ShoppingBag className="h-3 w-3" />
                  Orders
                </span>
                <span className="font-medium">
                  {usage.orders_this_month}
                  {limits.max_orders_per_month && ` / ${limits.max_orders_per_month}`}
                </span>
              </div>
              {limits.max_orders_per_month && (
                <Progress value={limits.orders_used_pct} className="h-1.5" />
              )}
            </div>

            {/* Revenue */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CreditCard className="h-3 w-3" />
                  Revenue
                </span>
                <span className="font-medium">{usage.revenue_this_month_formatted}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Platform fee: {billing.platform_fee_percent}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
