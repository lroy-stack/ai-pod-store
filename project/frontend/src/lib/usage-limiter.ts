/**
 * Usage Limiter Module
 *
 * Tier-based daily usage limits for chat, design generation, and mockups.
 * Uses Redis as primary store with Supabase RPC fallback.
 * Fail-open: if both stores fail, allows the action with a warning.
 */

import { getRedisClient, isRedisAvailable } from './redis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export type UserTier = 'anonymous' | 'free' | 'premium'
export type UsageAction = 'chat' | 'chat:messages' | 'design:generate' | 'design:mockup' | 'design:save'

export const USAGE_TIERS: Record<UserTier, Record<UsageAction, number>> = {
  anonymous: { chat: 5, 'chat:messages': 20, 'design:generate': 0, 'design:mockup': 3, 'design:save': 0 },
  free:      { chat: 50, 'chat:messages': 200, 'design:generate': 3, 'design:mockup': 5, 'design:save': 20 },
  premium:   { chat: 500, 'chat:messages': -1, 'design:generate': 30, 'design:mockup': 50, 'design:save': -1 },
} as const

export interface UsageResult {
  allowed: boolean
  current: number
  limit: number
  remaining: number
  resetAt: string // ISO date string (midnight UTC)
  source?: 'credits' | 'daily'
  creditsRemaining?: number
}

/**
 * Get today's date string in YYYY-MM-DD (UTC).
 */
function todayPeriod(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Get midnight UTC reset time for today.
 */
function getResetAt(): string {
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

/**
 * Seconds until midnight UTC.
 */
function secondsUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCDate(midnight.getUTCDate() + 1)
  midnight.setUTCHours(0, 0, 0, 0)
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000)
}

/**
 * Try Redis increment. Returns current count or null on failure.
 */
async function redisIncrement(identifier: string, action: string, period: string): Promise<number | null> {
  const client = getRedisClient()
  if (!client || !isRedisAvailable()) return null

  try {
    const key = `usage:${identifier}:${action}:${period}`
    const count = await client.incr(key)
    // Set expiry if this is the first increment
    if (count === 1) {
      await client.expire(key, secondsUntilMidnight())
    }
    return count
  } catch {
    return null
  }
}

/**
 * Try Redis decrement (rollback).
 */
async function redisDecrement(identifier: string, action: string, period: string): Promise<void> {
  const client = getRedisClient()
  if (!client || !isRedisAvailable()) return

  try {
    const key = `usage:${identifier}:${action}:${period}`
    await client.decr(key)
  } catch {
    // ignore
  }
}

/**
 * Try Redis get current count.
 */
async function redisGetCount(identifier: string, action: string, period: string): Promise<number | null> {
  const client = getRedisClient()
  if (!client || !isRedisAvailable()) return null

  try {
    const key = `usage:${identifier}:${action}:${period}`
    const val = await client.get(key)
    return val ? parseInt(val, 10) : 0
  } catch {
    return null
  }
}

/**
 * Supabase fallback: call increment_usage RPC.
 */
async function supabaseIncrement(
  identifier: string,
  action: string,
  period: string,
  limit: number
): Promise<{ allowed: boolean; current: number } | null> {
  try {
    const { data, error } = await supabase.rpc('increment_usage', {
      p_identifier: identifier,
      p_action: action,
      p_period: period,
      p_limit: limit,
    })
    if (error) {
      console.warn('[UsageLimiter] Supabase RPC error:', error.message)
      return null
    }
    return data as { allowed: boolean; current: number }
  } catch {
    return null
  }
}

/**
 * Supabase fallback: get current count.
 */
async function supabaseGetCount(identifier: string, action: string, period: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('user_usage')
      .select('count')
      .eq('identifier', identifier)
      .eq('action', action)
      .eq('period', period)
      .single()

    if (error) return 0 // No row = 0 usage
    return data?.count || 0
  } catch {
    return null
  }
}

/**
 * Consume a credit from the user's balance.
 */
async function consumeCredit(userId: string, action: string): Promise<{ success: boolean; balance: number }> {
  try {
    // Atomic decrement + log
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('credit_balance')
      .eq('id', userId)
      .single()

    if (fetchError || !user || user.credit_balance <= 0) {
      return { success: false, balance: 0 }
    }

    const newBalance = user.credit_balance - 1

    const { error: updateError } = await supabase
      .from('users')
      .update({ credit_balance: newBalance })
      .eq('id', userId)

    if (updateError) return { success: false, balance: user.credit_balance }

    // Log the transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: -1,
      reason: action,
      balance_after: newBalance,
    })

    return { success: true, balance: newBalance }
  } catch {
    return { success: false, balance: 0 }
  }
}

/**
 * Check if an action is allowed and increment usage counter.
 *
 * @param identifier - User ID (registered) or IP address (anonymous)
 * @param action - The action type (chat, design:generate, etc.)
 * @param tier - User's tier (anonymous, free, premium)
 * @param userId - Optional user ID for credit consumption (premium only)
 */
export async function checkAndIncrementUsage(
  identifier: string,
  action: UsageAction,
  tier: UserTier,
  userId?: string
): Promise<UsageResult> {
  const limit = USAGE_TIERS[tier]?.[action] ?? 0
  const period = todayPeriod()
  const resetAt = getResetAt()

  // Unlimited (-1)
  if (limit < 0) {
    return { allowed: true, current: 0, limit: -1, remaining: -1, resetAt, source: 'daily' }
  }

  // Blocked (limit = 0): deny immediately
  if (limit === 0) {
    return { allowed: false, current: 0, limit: 0, remaining: 0, resetAt }
  }

  // Try Redis first
  const redisCount = await redisIncrement(identifier, action, period)

  if (redisCount !== null) {
    if (redisCount > limit) {
      // Over limit — rollback Redis increment
      await redisDecrement(identifier, action, period)

      // Premium users: try credits
      if (tier === 'premium' && userId) {
        const creditResult = await consumeCredit(userId, action)
        if (creditResult.success) {
          return {
            allowed: true,
            current: redisCount - 1,
            limit,
            remaining: 0,
            resetAt,
            source: 'credits',
            creditsRemaining: creditResult.balance,
          }
        }
      }

      return { allowed: false, current: redisCount - 1, limit, remaining: 0, resetAt, source: 'daily' }
    }

    return {
      allowed: true,
      current: redisCount,
      limit,
      remaining: limit - redisCount,
      resetAt,
      source: 'daily',
    }
  }

  // Redis failed — try Supabase
  const supaResult = await supabaseIncrement(identifier, action, period, limit)

  if (supaResult !== null) {
    if (!supaResult.allowed) {
      // Premium users: try credits
      if (tier === 'premium' && userId) {
        const creditResult = await consumeCredit(userId, action)
        if (creditResult.success) {
          return {
            allowed: true,
            current: supaResult.current,
            limit,
            remaining: 0,
            resetAt,
            source: 'credits',
            creditsRemaining: creditResult.balance,
          }
        }
      }

      return {
        allowed: false,
        current: supaResult.current,
        limit,
        remaining: 0,
        resetAt,
        source: 'daily',
      }
    }

    return {
      allowed: true,
      current: supaResult.current,
      limit,
      remaining: Math.max(0, limit - supaResult.current),
      resetAt,
      source: 'daily',
    }
  }

  // Both failed — fail open with warning
  console.warn(`[UsageLimiter] Both Redis and Supabase failed for ${identifier}:${action}. Allowing request (fail-open).`)
  return { allowed: true, current: 0, limit, remaining: limit, resetAt, source: 'daily' }
}

/**
 * Get current usage without incrementing.
 */
export async function getCurrentUsage(
  identifier: string,
  action: UsageAction
): Promise<{ used: number; limit: number; remaining: number }> {
  const tier: UserTier = 'free' // Caller should provide tier context
  const limit = USAGE_TIERS[tier]?.[action] ?? 0
  const period = todayPeriod()

  const count = (await redisGetCount(identifier, action, period)) ??
    (await supabaseGetCount(identifier, action, period)) ?? 0

  return {
    used: count,
    limit,
    remaining: limit < 0 ? -1 : Math.max(0, limit - count),
  }
}

/**
 * Get current usage for a specific tier.
 */
export async function getUsageForTier(
  identifier: string,
  tier: UserTier
): Promise<Record<UsageAction, { used: number; limit: number; remaining: number }>> {
  const period = todayPeriod()
  const actions: UsageAction[] = ['chat', 'chat:messages', 'design:generate', 'design:mockup', 'design:save']
  const result = {} as Record<UsageAction, { used: number; limit: number; remaining: number }>

  for (const action of actions) {
    const limit = USAGE_TIERS[tier]?.[action] ?? 0
    const count = (await redisGetCount(identifier, action, period)) ??
      (await supabaseGetCount(identifier, action, period)) ?? 0

    result[action] = {
      used: count,
      limit,
      remaining: limit < 0 ? -1 : Math.max(0, limit - count),
    }
  }

  return result
}

/**
 * Build usage response headers (X-RateLimit-*).
 */
export function usageHeaders(result: UsageResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': result.resetAt,
  }
}
