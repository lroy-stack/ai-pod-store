/**
 * GET /api/tenant/gate?tenant_id=xxx&gate=products
 *
 * Checks a plan gate for a given tenant.
 * Used by admin and bridge to enforce per-plan feature limits.
 *
 * Query params:
 *   tenant_id  - Tenant UUID (required)
 *   gate       - 'products' | 'custom_domain' | 'orders_per_month'
 *   count      - Current usage count (optional, auto-resolved if not provided)
 *
 * Response: { allowed: boolean, reason?: string, plan: string, ... }
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPlanGate, PLAN_LIMITS } from '@/lib/plan-gates'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id')
  const gate = request.nextUrl.searchParams.get('gate') as 'products' | 'custom_domain' | 'orders_per_month'
  const countParam = request.nextUrl.searchParams.get('count')
  const count = countParam ? parseInt(countParam, 10) : undefined

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  if (!gate || !['products', 'custom_domain', 'orders_per_month'].includes(gate)) {
    return NextResponse.json({ error: 'Invalid gate. Use: products, custom_domain, orders_per_month' }, { status: 400 })
  }

  const result = await checkPlanGate(tenantId, gate, count)

  return NextResponse.json(result, {
    status: result.allowed ? 200 : 402,  // 402 Payment Required = need upgrade
  })
}

/**
 * GET /api/tenant/gate?all=true&tenant_id=xxx
 *
 * Returns the full plan limits for a tenant.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const tenantId = body.tenant_id || request.nextUrl.searchParams.get('tenant_id')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  const { checkPlanGate: check, getTenantPlan } = await import('@/lib/plan-gates')
  const plan = await getTenantPlan(tenantId)
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free

  return NextResponse.json({ plan, limits })
}
