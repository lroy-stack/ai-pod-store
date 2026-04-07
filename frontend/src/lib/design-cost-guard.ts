/**
 * Design Cost Guard
 *
 * Server-side spending limits per user tier.
 * Queries ai_generations table for monthly cost totals
 * and enforces per-generation and per-month caps.
 */

import { supabaseAdmin } from './supabase-admin'

export interface CostGuardResult {
  allowed: boolean
  reason?: string
  remaining?: number
}

interface TierCostLimits {
  perGeneration: number
  monthlyBudget: number
}

const COST_LIMITS: Record<string, TierCostLimits> = {
  free: {
    perGeneration: 0.05,
    monthlyBudget: 2.50,
  },
  premium: {
    perGeneration: 0.15,
    monthlyBudget: 25.00,
  },
}

/**
 * Get the current month's total cost for a user from ai_generations.
 */
async function getMonthlySpend(userId: string): Promise<number> {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

  const { data, error } = await supabaseAdmin
    .from('ai_generations')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd)

  if (error) {
    console.error('[CostGuard] Failed to query monthly spend:', error.message)
    // Fail closed: if we can't verify spending, deny the request
    return Infinity
  }

  if (!data || data.length === 0) {
    return 0
  }

  return data.reduce((sum: number, row: { cost_usd: number | null }) => sum + (row.cost_usd || 0), 0)
}

/**
 * Check if a user is within their cost budget for design generation.
 *
 * @param userId - The user's ID
 * @param tier - The user's subscription tier ('free' or 'premium')
 * @param estimatedCost - The estimated cost of the upcoming generation in USD
 * @returns CostGuardResult indicating whether the generation is allowed
 */
export async function checkCostGuard(
  userId: string,
  tier: string,
  estimatedCost: number
): Promise<CostGuardResult> {
  const limits = COST_LIMITS[tier] || COST_LIMITS.free

  // Check per-generation limit
  if (estimatedCost > limits.perGeneration) {
    return {
      allowed: false,
      reason: `Estimated cost $${estimatedCost.toFixed(2)} exceeds per-generation limit of $${limits.perGeneration.toFixed(2)} for ${tier} tier`,
      remaining: 0,
    }
  }

  // Check monthly budget
  const monthlySpend = await getMonthlySpend(userId)
  const remaining = Math.max(0, limits.monthlyBudget - monthlySpend)

  if (monthlySpend + estimatedCost > limits.monthlyBudget) {
    return {
      allowed: false,
      reason: `Monthly budget of $${limits.monthlyBudget.toFixed(2)} reached. Current spend: $${monthlySpend.toFixed(2)}`,
      remaining,
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, remaining - estimatedCost),
  }
}
