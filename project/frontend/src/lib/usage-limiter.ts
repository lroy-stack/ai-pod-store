/**
 * Usage Limiter Module
 *
 * Hybrid tier-based usage limits: daily for chat, monthly for designs.
 * Uses Supabase as the sole persistent store (no Redis).
 * Fail-CLOSED: if Supabase fails, DENY the action (no silent pass-through).
 */

import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { BASE_URL } from '@/lib/store-config'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export type UserTier = 'anonymous' | 'free' | 'premium'
export type UsageAction = 'chat' | 'chat:messages' | 'chat:tokens' | 'design:generate' | 'design:mockup' | 'design:save' | 'design:ai-generate' | 'design:refine' | 'design:upload'

type PeriodType = 'daily' | 'monthly'
type LimitConfig = { limit: number; period: PeriodType }

export const USAGE_TIERS: Record<UserTier, Record<UsageAction, LimitConfig>> = {
  anonymous: {
    chat:              { limit: 5,   period: 'daily' },
    'chat:messages':   { limit: 20,  period: 'daily' },
    'chat:tokens':     { limit: 50_000, period: 'daily' },
    'design:generate': { limit: 0,   period: 'monthly' },
    'design:mockup':   { limit: 3,   period: 'daily' },
    'design:save':     { limit: 0,   period: 'daily' },
    'design:ai-generate': { limit: 0, period: 'monthly' },
    'design:refine':   { limit: 0,   period: 'monthly' },
    'design:upload':   { limit: 0,   period: 'daily' },
  },
  free: {
    chat:              { limit: 30,  period: 'daily' },
    'chat:messages':   { limit: 200, period: 'daily' },
    'chat:tokens':     { limit: 500_000, period: 'daily' },
    'design:generate': { limit: 5,   period: 'monthly' },
    'design:mockup':   { limit: 10,  period: 'monthly' },
    'design:save':     { limit: 20,  period: 'daily' },
    'design:ai-generate': { limit: 5, period: 'monthly' },
    'design:refine':   { limit: 10,  period: 'monthly' },
    'design:upload':   { limit: 5,   period: 'daily' },
  },
  premium: {
    chat:              { limit: 100, period: 'daily' },
    'chat:messages':   { limit: -1,  period: 'daily' },
    'chat:tokens':     { limit: 2_000_000, period: 'daily' },
    'design:generate': { limit: 50,  period: 'monthly' },
    'design:mockup':   { limit: 100, period: 'monthly' },
    'design:save':     { limit: -1,  period: 'daily' },
    'design:ai-generate': { limit: 50, period: 'monthly' },
    'design:refine':   { limit: 100, period: 'monthly' },
    'design:upload':   { limit: 20,  period: 'daily' },
  },
}

export interface UsageResult {
  allowed: boolean
  current: number
  limit: number
  remaining: number
  resetAt: string // ISO date string
  periodType: PeriodType
  source?: 'credits' | 'daily' | 'monthly'
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

function monthPeriod(): string {
  return new Date().toISOString().slice(0, 7) // "2026-02"
}

function getResetAt(periodType: PeriodType): string {
  if (periodType === 'monthly') {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
  }
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
 * Supabase: increment usage by arbitrary amount (for token tracking).
 */
async function supabaseIncrementBy(
  identifier: string,
  action: string,
  period: string,
  amount: number,
  limit: number
): Promise<{ current: number; over: boolean } | null> {
  try {
    const { data, error } = await supabase.rpc('increment_usage_by', {
      p_identifier: identifier,
      p_action: action,
      p_period: period,
      p_amount: amount,
      p_limit: limit,
    })
    if (error) {
      console.error('[UsageLimiter] Supabase increment_by RPC error:', error.message)
      return null
    }
    return data as { current: number; over: boolean }
  } catch (err) {
    console.error('[UsageLimiter] Supabase increment_by RPC exception:', err)
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
 * Consume a credit atomically from the user's balance (premium overflow).
 * Uses Supabase RPC to prevent race conditions.
 */
async function consumeCredit(userId: string, action: string): Promise<{ success: boolean; balance: number }> {
  try {
    const { data, error } = await supabase.rpc('consume_credit_atomic', {
      p_user_id: userId,
      p_action: action,
    })

    if (error) {
      console.error('[UsageLimiter] consume_credit_atomic RPC error:', error.message)
      return { success: false, balance: 0 }
    }

    return { success: data?.success ?? false, balance: data?.balance ?? 0 }
  } catch {
    return { success: false, balance: 0 }
  }
}

/**
 * Resolve period string based on action's period type.
 */
function resolvePeriod(config: LimitConfig): string {
  return config.period === 'monthly' ? monthPeriod() : todayPeriod()
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
  const config = USAGE_TIERS[tier]?.[action] ?? { limit: 0, period: 'daily' as const }
  const limit = config.limit
  const period = resolvePeriod(config)
  const resetAt = getResetAt(config.period)
  const periodType = config.period

  // Unlimited (-1)
  if (limit < 0) {
    return { allowed: true, current: 0, limit: -1, remaining: -1, resetAt, periodType, source: periodType === 'monthly' ? 'monthly' : 'daily' }
  }

  // Blocked (limit = 0): deny immediately
  if (limit === 0) {
    return { allowed: false, current: 0, limit: 0, remaining: 0, resetAt, periodType }
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
            periodType,
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
        periodType,
        source: periodType === 'monthly' ? 'monthly' : 'daily',
      }
    }

    return {
      allowed: true,
      current: result.current,
      limit,
      remaining: Math.max(0, limit - result.current),
      resetAt,
      periodType,
      source: periodType === 'monthly' ? 'monthly' : 'daily',
    }
  }

  // Supabase failed — FAIL CLOSED (deny the request)
  console.error(`[UsageLimiter] Supabase failed for ${id}:${action}. DENYING request (fail-closed).`)

  // Fire-and-forget alert to admin
  fetch(`${BASE_URL}/api/admin/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'usage_limiter_failure',
      message: `Supabase RPC failed for ${action} — requests are being denied (fail-closed)`,
      severity: 'critical',
    }),
  }).catch(() => {})

  return { allowed: false, current: 0, limit, remaining: 0, resetAt, periodType, source: periodType === 'monthly' ? 'monthly' : 'daily' }
}

/**
 * Increment token usage (best-effort, non-blocking).
 * Returns current token count or null on failure.
 */
export async function incrementTokenUsage(
  identifier: string,
  tier: UserTier,
  tokens: number
): Promise<{ current: number; over: boolean } | null> {
  const id = normalizeIdentifier(identifier)
  const config = USAGE_TIERS[tier]?.['chat:tokens'] ?? { limit: 50_000, period: 'daily' as const }
  const period = resolvePeriod(config)
  return supabaseIncrementBy(id, 'chat:tokens', period, tokens, config.limit)
}

/**
 * Check if token budget is exhausted (pre-check before streaming).
 */
export async function checkTokenBudget(
  identifier: string,
  tier: UserTier
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const id = normalizeIdentifier(identifier)
  const config = USAGE_TIERS[tier]?.['chat:tokens'] ?? { limit: 50_000, period: 'daily' as const }
  const limit = config.limit
  if (limit < 0) return { allowed: true, current: 0, limit: -1 }
  const period = resolvePeriod(config)
  const current = await supabaseGetCount(id, 'chat:tokens', period)
  return { allowed: current < limit, current, limit }
}

/**
 * Decrement usage counter (rollback on failed actions).
 */
export async function decrementUsage(
  identifier: string,
  action: UsageAction,
  tier: UserTier = 'free'
): Promise<void> {
  const id = normalizeIdentifier(identifier)
  const config = USAGE_TIERS[tier]?.[action] ?? { limit: 0, period: 'daily' as const }
  const period = resolvePeriod(config)

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
): Promise<{ used: number; limit: number; remaining: number; periodType: PeriodType }> {
  const id = normalizeIdentifier(identifier)
  const config = USAGE_TIERS[tier]?.[action] ?? { limit: 0, period: 'daily' as const }
  const limit = config.limit
  const period = resolvePeriod(config)

  const count = await supabaseGetCount(id, action, period)

  return {
    used: count,
    limit,
    remaining: limit < 0 ? -1 : Math.max(0, limit - count),
    periodType: config.period,
  }
}

/**
 * Get current usage for all actions of a tier.
 */
export async function getUsageForTier(
  identifier: string,
  tier: UserTier
): Promise<Record<UsageAction, { used: number; limit: number; remaining: number; periodType: PeriodType; resetAt: string }>> {
  const id = normalizeIdentifier(identifier)
  const actions: UsageAction[] = ['chat', 'chat:messages', 'chat:tokens', 'design:generate', 'design:mockup', 'design:save', 'design:ai-generate', 'design:refine', 'design:upload']
  const result = {} as Record<UsageAction, { used: number; limit: number; remaining: number; periodType: PeriodType; resetAt: string }>

  for (const action of actions) {
    const config = USAGE_TIERS[tier]?.[action] ?? { limit: 0, period: 'daily' as const }
    const limit = config.limit
    const period = resolvePeriod(config)
    const count = await supabaseGetCount(id, action, period)

    result[action] = {
      used: count,
      limit,
      remaining: limit < 0 ? -1 : Math.max(0, limit - count),
      periodType: config.period,
      resetAt: getResetAt(config.period),
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
