/**
 * Usage Status API
 *
 * GET /api/usage/status
 * Returns current usage, limits, and subscription info for the requesting user.
 * Anonymous users get IP-based usage; authenticated users get user-based usage.
 * Includes periodType per action (daily vs monthly) for frontend display.
 */

import { NextRequest } from 'next/server'
import { getAuthUser, getClientIP } from '@/lib/auth-guard'
import { getUsageForTier, UserTier } from '@/lib/usage-limiter'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    const tier: UserTier = user ? (user.tier as UserTier) : 'anonymous'
    const identifier = user ? user.id : getClientIP(req)

    const usage = await getUsageForTier(identifier, tier)

    // Build response
    const response: Record<string, unknown> = {
      tier,
      usage,
    }

    if (user) {
      response.credits = {
        balance: user.credit_balance,
        canBuyMore: true,
      }

      // Fetch subscription info
      const { data: profile } = await supabase
        .from('users')
        .select('subscription_status, subscription_period_end')
        .eq('id', user.id)
        .single()

      response.subscription = {
        status: profile?.subscription_status || 'none',
        periodEnd: profile?.subscription_period_end || null,
      }
    }

    return Response.json(response)
  } catch (error) {
    console.error('Usage status error:', error)
    return Response.json({ error: 'Failed to fetch usage status' }, { status: 500 })
  }
}
