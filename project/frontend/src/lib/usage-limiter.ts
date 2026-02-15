/**
 * Usage Limiter Module
 *
 * Tier-based daily usage limits for chat, design generation, and mockups.
 * Uses Supabase as the sole persistent store (no Redis).
 * Fail-CLOSED: if Supabase fails, DENY the action (no silent pass-through).
 */

import { createHash } from 'crypto'
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
 * Normalize identifier for consistent counting.
 * UUIDs (user IDs) and fingerprints pass through unchanged.
 * IPs are hashed with a daily salt for GDPR compliance.
 */
function normalizeIdentifier(raw: string): string {
  // User IDs (UUIDs) pass through
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(raw)) return raw
  // Fingerprints pass through
  if (raw.startsWith('fp:')) return raw
  // Strip ip: prefix if present, then hash
  const ip = raw.startsWith('ip:') ? raw.slice(3) : raw
  const daySalt = new Date().toISOString().split('T')[0]
  const hash = createHash('sha256').update(`${ip}:${daySalt}`).digest('hex').substring(0, 16)
  return `h:${hash}`
}

function todayPeriod(): string {
  return new Date().toISOString().slice(0, 10)
}

function getResetAt(): string {
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

/**
 * Supabase increment via RPC (atomic check + increment).
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
      console.error('[UsageLimiter] Supabase RPC error:', error.message)
      return null
    }
    return data as { allowed: boolean; current: number }
  } catch (err) {
    console.error('[UsageLimiter] Supabase RPC exception:', err)
    return null
  }
}

/**
 * Supabase: get current count without incrementing.
 */
async function supabaseGetCount(identifier: string, action: string, period: string): Promise<number> {
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
    return 0
  }
}

/**
 * Consume a credit from the user's balance (premium overflow).
 */
async function consumeCredit(userId: string, action: string): Promise<{ success: boolean; balance: number }> {
  try {
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
 * Uses Supabase as sole store. Fail-CLOSED on errors.
 */
export async function checkAndIncrementUsage(
  identifier: string,
  action: UsageAction,
  tier: UserTier,
  userId?: string
): Promise<UsageResult> {
  const id = normalizeIdentifier(identifier)
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

  // Supabase atomic increment + check
  const result = await supabaseIncrement(id, action, period, limit)

  if (result !== null) {
    if (!result.allowed) {
      // Premium users: try credits as overflow
      if (tier === 'premium' && userId) {
        const creditResult = await consumeCredit(userId, action)
        if (creditResult.success) {
          return {
            allowed: true,
            current: result.current,
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
        current: result.current,
        limit,
        remaining: 0,
        resetAt,
        source: 'daily',
      }
    }

    return {
      allowed: true,
      current: result.current,
      limit,
      remaining: Math.max(0, limit - result.current),
      resetAt,
      source: 'daily',
    }
  }

  // Supabase failed — FAIL CLOSED (deny the request)
  console.error(`[UsageLimiter] Supabase failed for ${id}:${action}. DENYING request (fail-closed).`)

  // Fire-and-forget alert to admin
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  fetch(`${baseUrl}/api/admin/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'usage_limiter_failure',
      message: `Supabase RPC failed for ${action} — requests are being denied (fail-closed)`,
      severity: 'critical',
    }),
  }).catch(() => {})

  return { allowed: false, current: 0, limit, remaining: 0, resetAt, source: 'daily' }
}

/**
 * Decrement usage counter (rollback on failed actions).
 */
export async function decrementUsage(
  identifier: string,
  action: UsageAction
): Promise<void> {
  const id = normalizeIdentifier(identifier)
  const period = todayPeriod()

  try {
    await supabase.rpc('decrement_usage', {
      p_identifier: id,
      p_action: action,
      p_period: period,
    })
  } catch {
    // Best-effort rollback
  }
}

/**
 * Get current usage without incrementing.
 */
export async function getCurrentUsage(
  identifier: string,
  action: UsageAction,
  tier: UserTier = 'free'
): Promise<{ used: number; limit: number; remaining: number }> {
  const id = normalizeIdentifier(identifier)
  const limit = USAGE_TIERS[tier]?.[action] ?? 0
  const period = todayPeriod()

  const count = await supabaseGetCount(id, action, period)

  return {
    used: count,
    limit,
    remaining: limit < 0 ? -1 : Math.max(0, limit - count),
  }
}

/**
 * Get current usage for all actions of a tier.
 */
export async function getUsageForTier(
  identifier: string,
  tier: UserTier
): Promise<Record<UsageAction, { used: number; limit: number; remaining: number }>> {
  const id = normalizeIdentifier(identifier)
  const period = todayPeriod()
  const actions: UsageAction[] = ['chat', 'chat:messages', 'design:generate', 'design:mockup', 'design:save']
  const result = {} as Record<UsageAction, { used: number; limit: number; remaining: number }>

  for (const action of actions) {
    const limit = USAGE_TIERS[tier]?.[action] ?? 0
    const count = await supabaseGetCount(id, action, period)

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
