/**
 * Plan Gates — Feature limit enforcement per tenant plan tier.
 *
 * Usage in API routes:
 *   import { checkPlanGate, PLAN_LIMITS } from '@/lib/plan-gates'
 *
 *   const gateResult = await checkPlanGate(tenantId, 'products', productCount)
 *   if (!gateResult.allowed) {
 *     return NextResponse.json({ error: gateResult.reason }, { status: 402 })
 *   }
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

// Plan definitions
export interface PlanConfig {
  max_products: number | null        // null = unlimited
  max_orders_per_month: number | null
  custom_domain: boolean
  api_rate_limit_per_min: number     // requests per minute for API calls
  max_chat_messages_per_day: number | null
}

export const PLAN_LIMITS: Record<string, PlanConfig> = {
  free: {
    max_products: 10,
    max_orders_per_month: 100,
    custom_domain: false,
    api_rate_limit_per_min: 30,
    max_chat_messages_per_day: 50,
  },
  starter: {
    max_products: 50,
    max_orders_per_month: 500,
    custom_domain: true,
    api_rate_limit_per_min: 120,
    max_chat_messages_per_day: 200,
  },
  pro: {
    max_products: 200,
    max_orders_per_month: 2000,
    custom_domain: true,
    api_rate_limit_per_min: 300,
    max_chat_messages_per_day: 1000,
  },
  enterprise: {
    max_products: null,
    max_orders_per_month: null,
    custom_domain: true,
    api_rate_limit_per_min: 1000,
    max_chat_messages_per_day: null,
  },
}

export interface GateResult {
  allowed: boolean
  reason?: string
  limit?: number | null
  current?: number
  plan?: string
  upgrade_to?: string
}

/**
 * Look up a tenant's plan.
 * Returns 'free' as fallback if tenant not found.
 */
export async function getTenantPlan(tenantId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('tenants')
      .select('plan')
      .eq('id', tenantId)
      .single()
    return data?.plan ?? 'free'
  } catch {
    return 'free'
  }
}

/**
 * Check if a tenant is allowed to perform an action based on their plan.
 *
 * @param tenantId - Tenant UUID
 * @param gate - The gate to check: 'products' | 'custom_domain' | 'orders_per_month'
 * @param currentCount - Current usage count (for numeric gates)
 */
export async function checkPlanGate(
  tenantId: string,
  gate: 'products' | 'custom_domain' | 'orders_per_month',
  currentCount?: number
): Promise<GateResult> {
  const plan = await getTenantPlan(tenantId)
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free

  switch (gate) {
    case 'products': {
      const limit = limits.max_products
      if (limit === null) return { allowed: true, plan }

      const count = currentCount ?? await getProductCount(tenantId)
      if (count >= limit) {
        return {
          allowed: false,
          reason: `Your ${plan} plan allows up to ${limit} products. Upgrade to add more.`,
          limit,
          current: count,
          plan,
          upgrade_to: getNextPlan(plan),
        }
      }
      return { allowed: true, plan, limit, current: count }
    }

    case 'custom_domain': {
      if (!limits.custom_domain) {
        return {
          allowed: false,
          reason: `Custom domains require Starter plan or higher. Your current plan is ${plan}.`,
          plan,
          upgrade_to: 'starter',
        }
      }
      return { allowed: true, plan }
    }

    case 'orders_per_month': {
      const limit = limits.max_orders_per_month
      if (limit === null) return { allowed: true, plan }

      const count = currentCount ?? 0
      if (count >= limit) {
        return {
          allowed: false,
          reason: `Your ${plan} plan allows up to ${limit} orders per month. Upgrade for more capacity.`,
          limit,
          current: count,
          plan,
          upgrade_to: getNextPlan(plan),
        }
      }
      return { allowed: true, plan, limit, current: count }
    }

    default:
      return { allowed: true, plan }
  }
}

/** Returns the suggested upgrade plan tier */
function getNextPlan(plan: string): string {
  const tiers = ['free', 'starter', 'pro', 'enterprise']
  const idx = tiers.indexOf(plan)
  return tiers[Math.min(idx + 1, tiers.length - 1)]
}

/** Count active products for a tenant */
async function getProductCount(tenantId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  return count ?? 0
}

/**
 * Returns the rate limit (requests/minute) for a given tenant's plan.
 * Used by API middleware to enforce per-plan rate limits.
 */
export async function getTenantRateLimit(tenantId: string | null): Promise<number> {
  if (!tenantId) return PLAN_LIMITS.free.api_rate_limit_per_min
  const plan = await getTenantPlan(tenantId)
  return (PLAN_LIMITS[plan] ?? PLAN_LIMITS.free).api_rate_limit_per_min
}
