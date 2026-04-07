/**
 * POST /api/designs/ai-generate/refine
 *
 * Refinement endpoint for AI-generated designs.
 * Takes a parent generation and a refinement prompt to produce an improved version.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { checkPromptSafety } from '@/lib/content-safety'
import { checkAndIncrementUsage, usageHeaders, type UserTier } from '@/lib/usage-limiter'
import { orchestrateDesign } from '@/lib/ai-design-orchestrator'
import { generateDesign } from '@/lib/design-generation'
import { checkCostGuard } from '@/lib/design-cost-guard'
import { estimateDesignCost } from '@/lib/design-generation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { designGenerateLimiter } from '@/lib/rate-limit'

const refineSchema = z.object({
  generation_id: z.string().uuid('Invalid generation ID'),
  refinement_prompt: z.string().min(3, 'Refinement prompt must be at least 3 characters').max(1000, 'Refinement prompt must be at most 1000 characters'),
})

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    let user
    try {
      user = await requireAuth(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    // Rate limiting
    const rateLimitKey = `design:refine:${user.id}`
    const rateLimitResult = designGenerateLimiter.check(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum 5 refinements per minute. Please wait and try again.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'Retry-After': '60',
          },
        }
      )
    }

    // Parse and validate
    const body = await req.json()
    const validation = refineSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { generation_id, refinement_prompt } = validation.data

    // 2. Content safety check on refinement prompt
    const safety = checkPromptSafety(refinement_prompt)
    if (!safety.safe) {
      return NextResponse.json(
        { error: `Content policy violation: ${safety.reason}`, code: 'CONTENT_UNSAFE' },
        { status: 422 }
      )
    }

    // 3. Fetch parent generation
    const { data: parentGeneration, error: fetchError } = await supabaseAdmin
      .from('ai_generations')
      .select('*')
      .eq('id', generation_id)
      .single()

    if (fetchError || !parentGeneration) {
      return NextResponse.json(
        { error: 'Parent generation not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (parentGeneration.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // 4. Usage limit check
    const tier = (user.tier || 'free') as UserTier
    const usageResult = await checkAndIncrementUsage(user.id, 'design:refine', tier, user.id)
    if (!usageResult.allowed) {
      return NextResponse.json(
        {
          error: 'Refinement limit reached',
          usage: usageResult,
          code: 'LIMIT_REACHED',
        },
        { status: 429, headers: usageHeaders(usageResult) }
      )
    }

    // 5. Cost guard check
    const intent = parentGeneration.intent || 'general'
    const costEstimate = estimateDesignCost({ intent })
    const costGuard = await checkCostGuard(user.id, tier, costEstimate.estimatedCostEur)
    if (!costGuard.allowed) {
      return NextResponse.json(
        {
          error: costGuard.reason || 'Cost budget exceeded',
          code: 'COST_LIMIT_EXCEEDED',
          remaining: costGuard.remaining,
        },
        { status: 429 }
      )
    }

    // 6. Build refined prompt by combining parent prompt with refinement
    const originalPrompt = parentGeneration.prompt || ''
    const combinedPrompt = `${originalPrompt}. Refinement: ${refinement_prompt}`
    const productType = parentGeneration.product_type || 't-shirt'

    const orchestration = orchestrateDesign(
      combinedPrompt,
      productType,
      parentGeneration.style_preset || undefined
    )

    // 7. Generate refined design
    const startTime = Date.now()
    const result = await generateDesign({
      prompt: orchestration.engineeredPrompt,
      negativePrompt: orchestration.negativePrompt,
      intent: orchestration.intent,
      transparentBg: true,
    })
    const inferenceMs = Date.now() - startTime

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate refined design' },
        { status: 500 }
      )
    }

    // 8. Save refined generation
    let generationId: string | null = null
    try {
      const { data: generation } = await supabaseAdmin
        .from('ai_generations')
        .insert({
          user_id: user.id,
          session_id: parentGeneration.session_id || null,
          prompt: combinedPrompt,
          engineered_prompt: orchestration.engineeredPrompt,
          negative_prompt: orchestration.negativePrompt,
          intent: orchestration.intent,
          confidence: orchestration.confidence,
          style_preset: parentGeneration.style_preset || null,
          product_type: productType,
          product_id: parentGeneration.product_id || null,
          image_url: result.imageUrl,
          provider: result.provider || 'unknown',
          cost_usd: result.costUsd || 0,
          inference_ms: result.timings?.inference || inferenceMs,
          seed: result.seed || null,
          is_refinement: true,
          parent_generation_id: validation.data.generation_id,
        })
        .select('id')
        .single()

      generationId = generation?.id || null
    } catch (err) {
      console.error('[ai-generate/refine] Failed to save generation record:', err)
    }

    return NextResponse.json({
      success: true,
      generation_id: generationId,
      image_url: result.imageUrl,
      provider: result.provider,
      inference_ms: result.timings?.inference || inferenceMs,
      intent: orchestration.intent,
      confidence: orchestration.confidence,
      is_refinement: true,
      parent_generation_id: generation_id,
      usage: usageResult,
    })
  } catch (error) {
    console.error('POST /api/designs/ai-generate/refine error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: 'Design refinement failed',
      },
      { status: 500 }
    )
  }
}
