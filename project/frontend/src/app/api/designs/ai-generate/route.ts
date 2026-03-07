/**
 * POST /api/designs/ai-generate
 *
 * AI-powered design generation endpoint.
 * Orchestrates prompt engineering, safety checks, usage limits,
 * cost guards, and multi-provider image generation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { checkPromptSafety } from '@/lib/content-safety'
import { checkAndIncrementUsage, usageHeaders, type UserTier } from '@/lib/usage-limiter'
import { orchestrateDesign } from '@/lib/ai-design-orchestrator'
import { generateDesign, estimateDesignCost } from '@/lib/design-generation'
import { checkCostGuard } from '@/lib/design-cost-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { designGenerateLimiter } from '@/lib/rate-limit'

const aiGenerateSchema = z.object({
  prompt: z.string().min(3, 'Prompt must be at least 3 characters').max(1000, 'Prompt must be at most 1000 characters'),
  style_preset: z.string().optional(),
  product_id: z.string().optional(),
  product_type: z.string().min(1, 'Product type is required'),
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

    // Rate limiting: 5 requests per minute per user
    const rateLimitKey = `design:ai-generate:${user.id}`
    const rateLimitResult = designGenerateLimiter.check(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum 5 AI design generations per minute. Please wait and try again.',
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

    // Parse and validate request body
    const body = await req.json()
    const validation = aiGenerateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { prompt, style_preset, product_id, product_type } = validation.data

    // 2. Content safety check
    const safety = checkPromptSafety(prompt)
    if (!safety.safe) {
      return NextResponse.json(
        { error: `Content policy violation: ${safety.reason}`, code: 'CONTENT_UNSAFE' },
        { status: 422 }
      )
    }

    // 3. Usage limit check
    const tier = (user.tier || 'free') as UserTier
    const usageResult = await checkAndIncrementUsage(user.id, 'design:ai-generate', tier, user.id)
    if (!usageResult.allowed) {
      return NextResponse.json(
        {
          error: 'AI design generation limit reached',
          usage: usageResult,
          code: 'LIMIT_REACHED',
        },
        { status: 429, headers: usageHeaders(usageResult) }
      )
    }

    // 4. Orchestrate design (classify intent + engineer prompt)
    const orchestration = orchestrateDesign(prompt, product_type, style_preset)

    // 5. Cost guard check
    const costEstimate = estimateDesignCost({ intent: orchestration.intent })
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

    // 6. Create or get design session
    let sessionId: string | null = null
    try {
      const { data: session } = await supabaseAdmin
        .from('design_sessions')
        .insert({
          user_id: user.id,
          product_type,
          product_id: product_id || null,
          status: 'active',
        })
        .select('id')
        .single()

      sessionId = session?.id || null
    } catch {
      // Non-critical: continue without session tracking
      console.warn('[ai-generate] Failed to create design session')
    }

    // 7. Generate design
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
        { error: result.error || 'Failed to generate design' },
        { status: 500 }
      )
    }

    // 8. Insert into ai_generations table
    let generationId: string | null = null
    try {
      const { data: generation } = await supabaseAdmin
        .from('ai_generations')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          prompt: prompt,
          engineered_prompt: orchestration.engineeredPrompt,
          negative_prompt: orchestration.negativePrompt,
          intent: orchestration.intent,
          confidence: orchestration.confidence,
          style_preset: style_preset || null,
          product_type,
          product_id: product_id || null,
          image_url: result.imageUrl,
          provider: result.provider || 'unknown',
          cost_usd: result.costUsd || 0,
          inference_ms: result.timings?.inference || inferenceMs,
          seed: result.seed || null,
          is_refinement: false,
          parent_generation_id: null,
        })
        .select('id')
        .single()

      generationId = generation?.id || null
    } catch (err) {
      console.error('[ai-generate] Failed to save generation record:', err)
    }

    return NextResponse.json({
      success: true,
      generation_id: generationId,
      image_url: result.imageUrl,
      provider: result.provider,
      inference_ms: result.timings?.inference || inferenceMs,
      intent: orchestration.intent,
      confidence: orchestration.confidence,
      usage: usageResult,
    })
  } catch (error) {
    console.error('POST /api/designs/ai-generate error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: 'AI generation failed',
      },
      { status: 500 }
    )
  }
}
