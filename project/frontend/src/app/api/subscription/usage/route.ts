/**
 * Subscription Usage API
 *
 * GET /api/subscription/usage
 * Returns authenticated user's current usage, tier, credits, and limits.
 */

import { NextRequest } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Define tier limits (must match USAGE_TIERS in usage-limiter.ts)
const TIER_LIMITS = {
  free: {
    chats_per_day: 30,
    designs_per_month: 5,
    mockups_per_month: 10,
  },
  premium: {
    chats_per_day: 100,
    designs_per_month: 50,
    mockups_per_month: 100,
  },
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

    const tier = profile.tier || 'free'
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS]

    return Response.json({
      tier,
      credit_balance: profile.credit_balance || 0,
      subscription_status: profile.subscription_status || 'none',
      limits: {
        chats_per_day: limits.chats_per_day,
        designs_per_month: limits.designs_per_month,
        mockups_per_month: limits.mockups_per_month,
      },
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
