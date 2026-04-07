import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateMockup } from '@/lib/mockup-generator'
import { getAuthUser, getClientIP } from '@/lib/auth-guard'
import { checkAndIncrementUsage, usageHeaders, UserTier } from '@/lib/usage-limiter'
import { mockupGenerateLimiter } from '@/lib/rate-limit'

const mockupRequestSchema = z.object({
  designUrl: z.string().url('Invalid design URL'),
  productType: z.enum(['tshirt', 'hoodie', 'mug', 'phone-case', 'tote-bag']),
  color: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Auth + usage check
    const user = await getAuthUser(req)
    const tier: UserTier = user?.tier || 'anonymous'
    const identifier = user?.id || getClientIP(req)

    // Burst rate limiting: 10 requests per minute per identifier
    const rateLimitKey = `mockup:${identifier}`
    const rateLimitResult = mockupGenerateLimiter.check(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum 10 mockup generations per minute. Please wait and try again.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'Retry-After': '60',
          },
        }
      )
    }

    const usageResult = await checkAndIncrementUsage(identifier, 'design:mockup', tier, user?.id)
    if (!usageResult.allowed) {
      return NextResponse.json(
        {
          error: user
            ? 'Mockup limit reached. Upgrade for more.'
            : 'Mockup limit reached. Sign up for more.',
          usage: usageResult,
          code: 'LIMIT_REACHED',
        },
        { status: 429, headers: usageHeaders(usageResult) }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const validation = mockupRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { designUrl, productType, color } = validation.data

    // Generate the mockup (watermark for anonymous users)
    const result = await generateMockup({ designUrl, productType, color, watermark: !user })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate mockup' },
        { status: 500 }
      )
    }

    const headers = usageHeaders(usageResult)
    return NextResponse.json(
      {
        success: true,
        mockupUrl: result.mockupUrl,
        productType,
        placeholder: result.placeholder,
        watermarked: !user,
        usage: usageResult,
      },
      { headers }
    )
  } catch (error) {
    console.error('POST /api/designs/mockup error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: 'Mockup generation failed',
      },
      { status: 500 }
    )
  }
}
