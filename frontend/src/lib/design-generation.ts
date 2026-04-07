/**
 * Shared design generation logic with smart intent-based routing.
 * Routes each design to the best provider with automatic fallbacks.
 */

import type { GenerationRequest } from './providers/types'
import type { UserTier } from './usage-limiter'
import { routeDesign, type DesignIntent } from './providers/router'
import { engineerPrompt, engineerNegativePrompt } from './providers/prompt-engineer'

export interface DesignGenerationParams {
  prompt: string
  style?: string
  negativePrompt?: string
  intent?: DesignIntent
  transparentBg?: boolean
  format?: 'png' | 'svg'
  tier?: UserTier
}

export interface DesignGenerationResult {
  success: boolean
  imageUrl?: string
  prompt?: string
  seed?: number
  timings?: {
    inference: number
  }
  placeholder?: boolean
  note?: string
  error?: string
  provider?: string
  costUsd?: number
  intent?: DesignIntent
}

/**
 * Estimate cost of a design generation using the real router.
 */
export function estimateDesignCost(options?: {
  style?: string
  intent?: DesignIntent
  tier?: UserTier
}): { credits: number; estimatedCostEur: number } {
  try {
    const route = routeDesign(options?.intent || 'general', options?.tier || 'free')
    const costUsd = route.primary.estimateCost({ prompt: '', numImages: 1 })
    // Convert USD to EUR (~0.92 rate, rounded up for margin)
    const costEur = Math.round(costUsd * 0.95 * 100) / 100
    return { credits: 1, estimatedCostEur: costEur || 0.05 }
  } catch {
    return { credits: 1, estimatedCostEur: 0.05 }
  }
}

/**
 * Generate a design with smart intent-based routing and fallbacks.
 */
export async function generateDesign(
  params: DesignGenerationParams
): Promise<DesignGenerationResult> {
  const prompt = params.prompt || 'custom design'
  const { style, negativePrompt, intent, transparentBg, format, tier } = params

  let route: ReturnType<typeof routeDesign>
  try {
    route = routeDesign(intent || 'general', tier || 'free')
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No providers available',
    }
  }

  const providers = [route.primary, ...route.fallbacks]

  for (const provider of providers) {
    const adaptedPrompt = engineerPrompt(provider.name, prompt, style)
    const adaptedNegative = engineerNegativePrompt(provider.name, negativePrompt)

    // When intent is 'vector' and targeting Recraft, hint SVG format
    const effectiveFormat = format || (route.intent === 'vector' && provider.name === 'recraft' ? 'svg' : undefined)

    const request: GenerationRequest = {
      prompt: adaptedPrompt,
      negativePrompt: adaptedNegative,
      style,
      width: 1024,
      height: 1024,
      numImages: 1,
      transparentBg,
      format: effectiveFormat,
    }

    console.log(`[design] Trying provider: ${provider.name} (intent: ${route.intent})`)

    const result = await provider.generate(request)

    if (result.success && result.images.length > 0) {
      return {
        success: true,
        imageUrl: result.images[0].url,
        prompt: adaptedPrompt,
        seed: result.seed,
        timings: { inference: result.latencyMs },
        provider: result.provider,
        costUsd: result.costUsd,
        intent: route.intent,
      }
    }

    if (result.nsfw) {
      return {
        success: false,
        error: result.error || 'Design rejected by safety checker. Please modify your prompt.',
      }
    }

    console.warn(`[design] Provider ${provider.name} failed: ${result.error}`)
  }

  // All providers failed — dev fallback
  return devFallback(prompt, route.intent)
}

function devFallback(originalPrompt: string, intent: DesignIntent): DesignGenerationResult {
  if (process.env.NODE_ENV === 'development') {
    const placeholderUrl = `https://placehold.co/1024x1024/667eea/ffffff?text=${encodeURIComponent(originalPrompt.slice(0, 50))}`
    return {
      success: true,
      imageUrl: placeholderUrl,
      prompt: originalPrompt,
      seed: Math.floor(Math.random() * 1000000),
      timings: { inference: 0 },
      placeholder: true,
      note: 'Placeholder image - all providers failed',
      provider: 'placeholder',
      costUsd: 0,
      intent,
    }
  }

  return {
    success: false,
    error: 'All design generation providers failed',
  }
}
