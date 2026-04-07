import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateDesign } from '@/lib/design-generation'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { checkAndIncrementUsage, usageHeaders, UserTier } from '@/lib/usage-limiter'
import { checkPromptSafety } from '@/lib/content-safety'
import { designGenerateLimiter } from '@/lib/rate-limit'

const designRequestSchema = z.object({
  prompt: z.string().min(3, 'Prompt must be at least 3 characters').max(2000),
  style: z.string().optional(),
  negativePrompt: z.string().optional(),
  intent: z.enum(['artistic', 'text-heavy', 'photorealistic', 'vector', 'pattern', 'quick-draft', 'general']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Auth required for design generation
    let user
    try {
      user = await requireAuth(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    // Rate limiting: 5 requests per minute per user
    const rateLimitKey = `design:generate:${user.id}`
    const rateLimitResult = designGenerateLimiter.check(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum 5 design generations per minute. Please wait and try again.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'Retry-After': '60',
          }
        }
      )
    }

    // Check usage limits
    const tier = (user.tier || 'free') as UserTier
    const usageResult = await checkAndIncrementUsage(user.id, 'design:generate', tier, user.id)
    if (!usageResult.allowed) {
      return NextResponse.json(
        {
          error: 'Design generation limit reached',
          usage: usageResult,
          code: 'LIMIT_REACHED',
        },
        { status: 429, headers: usageHeaders(usageResult) }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const validation = designRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { prompt, style, negativePrompt, intent } = validation.data

    // Content safety check
    const safety = checkPromptSafety(prompt)
    if (!safety.safe) {
      return NextResponse.json(
        { error: `Content policy violation: ${safety.reason}` },
        { status: 422 }
      )
    }

    // Generate the design using shared utility with intent routing
    const result = await generateDesign({ prompt, style, negativePrompt, intent })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate design' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      seed: result.seed,
      timings: result.timings,
      placeholder: result.placeholder,
      note: result.note,
      usage: usageResult,
    })
  } catch (error) {
    console.error('POST /api/designs/generate error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: 'Design generation failed',
      },
      { status: 500 }
    )
  }
}
