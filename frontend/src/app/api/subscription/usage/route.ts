/**
 * Subscription Usage API
 *
 * GET /api/subscription/usage
 * Returns authenticated user's current usage, tier, credits, and limits.
 */

import { NextRequest } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'
import { USAGE_TIERS, type UserTier } from '@/lib/usage-limiter'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Derive tier limits from canonical USAGE_TIERS (usage-limiter.ts)
function getTierLimits(tier: UserTier) {
  const t = USAGE_TIERS[tier]
  return {
    chats_per_day: t.chat.limit,
    designs_per_month: t['design:generate'].limit,
    mockups_per_month: t['design:mockup'].limit,
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Fetch user profile with usage data
    const { data: profile, error: fetchError } = await supabase
      .from('users')
      .select('tier, credit_balance, subscription_status')
      .eq('id', user.id)
      .single()

    if (fetchError || !profile) {
      return Response.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    const tier = (profile.tier || 'free') as UserTier
    const limits = getTierLimits(tier)

    return Response.json({
      tier,
      credit_balance: profile.credit_balance || 0,
      subscription_status: profile.subscription_status || 'none',
      limits,
    })
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      return authErrorResponse(error)
    }
    console.error('Subscription usage error:', error)
    return Response.json(
      { error: 'Failed to fetch subscription usage' },
      { status: 500 }
    )
  }
}
