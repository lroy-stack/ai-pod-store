/**
 * GET /api/tenants/[id]/billing
 *
 * Returns billing and usage information for a specific tenant:
 *   - plan (free / starter / pro / enterprise)
 *   - stripe_connected_account_id (from tenant_configs)
 *   - usage: product_count, order_count (last 30 days), this_month_revenue
 *   - plan limits (based on plan tier)
 *
 * Authentication: admin session required (handled by admin middleware).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withAuth } from '@/lib/auth-middleware'

// Platform application fee rates by plan
export const PLAN_FEE_RATES: Record<string, number> = {
  free: 0.10,       // 10%
  starter: 0.05,    // 5%
  pro: 0.03,        // 3%
  enterprise: 0.02, // 2%
}

// Product limits per plan (null = unlimited)
export const PLAN_LIMITS: Record<string, { products: number | null; orders_per_month: number | null; custom_domain: boolean }> = {
  free: { products: 10, orders_per_month: 100, custom_domain: false },
  starter: { products: 50, orders_per_month: 500, custom_domain: true },
  pro: { products: 200, orders_per_month: 2000, custom_domain: true },
  enterprise: { products: null, orders_per_month: null, custom_domain: true },
}

export const GET = withAuth(async (
  _request: NextRequest,
  session: unknown,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: tenantId } = await context.params

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  try {
    // Fetch tenant details, stripe config, and usage in parallel
    const [tenantResult, connectResult, productResult, ordersResult] = await Promise.all([
      // Tenant plan + status
      supabaseAdmin
        .from('tenants')
        .select('id, name, slug, plan, status, domain, created_at')
        .eq('id', tenantId)
        .single(),

      // Stripe connected account ID
      supabaseAdmin
        .from('tenant_configs')
        .select('value')
        .eq('tenant_id', tenantId)
        .eq('key', 'stripe:connected_account_id')
        .maybeSingle(),

      // Product count for this tenant
      supabaseAdmin
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),

      // Orders this month
      supabaseAdmin
        .from('orders')
        .select('id, total_amount, created_at', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ])

    if (tenantResult.error || !tenantResult.data) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const tenant = tenantResult.data
    const plan = tenant.plan ?? 'free'
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
    const feeRate = PLAN_FEE_RATES[plan] ?? 0.10

    // Calculate this month's revenue
    const thisMonthRevenue = (ordersResult.data ?? []).reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0
    )

    // Extract stripe connected account ID value
    const connectConfigValue = connectResult.data?.value
    const stripeConnectedAccountId = typeof connectConfigValue === 'string'
      ? connectConfigValue
      : (connectConfigValue as { v?: string } | null)?.v ?? null

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan,
        status: tenant.status,
        domain: tenant.domain,
        created_at: tenant.created_at,
      },
      billing: {
        stripe_connected_account_id: stripeConnectedAccountId,
        platform_fee_rate: feeRate,
        platform_fee_percent: `${(feeRate * 100).toFixed(0)}%`,
      },
      usage: {
        product_count: productResult.count ?? 0,
        orders_this_month: ordersResult.count ?? 0,
        revenue_this_month: thisMonthRevenue,
        revenue_this_month_formatted: `$${(thisMonthRevenue / 100).toFixed(2)}`,
      },
      limits: {
        max_products: limits.products,
        max_orders_per_month: limits.orders_per_month,
        custom_domain_allowed: limits.custom_domain,
        products_used_pct: limits.products
          ? Math.round(((productResult.count ?? 0) / limits.products) * 100)
          : 0,
        orders_used_pct: limits.orders_per_month
          ? Math.round(((ordersResult.count ?? 0) / limits.orders_per_month) * 100)
          : 0,
      },
    })
  } catch (err) {
    console.error('[/api/tenants/[id]/billing]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
