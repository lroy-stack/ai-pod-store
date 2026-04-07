/**
 * GET /api/designs/estimate
 *
 * Returns estimated cost of a design generation without executing it.
 * Useful for showing users the cost before they commit.
 */

import { NextRequest, NextResponse } from 'next/server'
import { estimateDesignCost } from '@/lib/design-generation'
import type { DesignIntent } from '@/lib/providers/router'
import { getAuthUser, getClientIP } from '@/lib/auth-guard'
import { getCurrentUsage, UserTier } from '@/lib/usage-limiter'

const VALID_INTENTS = new Set<string>(['artistic', 'text-heavy', 'photorealistic', 'vector', 'pattern', 'quick-draft', 'general'])

export async function GET(req: NextRequest) {
  try {
    const style = req.nextUrl.searchParams.get('style') || undefined
    const rawIntent = req.nextUrl.searchParams.get('intent')
    const intent = rawIntent && VALID_INTENTS.has(rawIntent) ? (rawIntent as DesignIntent) : undefined
    const estimate = estimateDesignCost({ style, intent })

    // Get remaining usage for context
    const user = await getAuthUser(req)
    const tier: UserTier = user?.tier || 'anonymous'
    const identifier = user?.id || getClientIP(req)
    const usage = await getCurrentUsage(identifier, 'design:generate', tier)

    return NextResponse.json({
      credits: estimate.credits,
      estimatedCost: `€${estimate.estimatedCostEur.toFixed(2)}`,
      estimatedCostEur: estimate.estimatedCostEur,
      remaining: usage.remaining,
      limit: usage.limit,
    })
  } catch (error) {
    console.error('GET /api/designs/estimate error:', error)
    return NextResponse.json(
      { error: 'Failed to estimate cost' },
      { status: 500 }
    )
  }
}
