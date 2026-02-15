/**
 * Shared design generation logic with multi-provider fallback
 * Used by both /api/designs/generate and chat tools
 */

export interface DesignGenerationParams {
  prompt: string
  style?: string
  negativePrompt?: string
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
}

/**
 * Estimate cost of a design generation.
 */
export function estimateDesignCost(options?: { style?: string }): { credits: number; estimatedCostEur: number } {
  return { credits: 1, estimatedCostEur: 0.05 }
}

/**
 * Generate a design with multi-provider fallback chain:
 * 1. fal.ai FLUX.1 schnell (fastest, ~2s)
 * 2. fal.ai FLUX.1 dev (slower but more robust, ~8-15s)
 * 3. Placeholder in development
 */
export async function generateDesign(
  params: DesignGenerationParams
): Promise<DesignGenerationResult> {
  const prompt = params.prompt || 'custom design'
  const { style, negativePrompt } = params

  const finalPrompt = style
    ? `${prompt}, ${style} style, high quality, professional design`
    : `${prompt}, high quality, professional design`

  const finalNegativePrompt =
    negativePrompt ||
    'blurry, low quality, watermark, text, signature, distorted, ugly'

  const FAL_KEY = process.env.FAL_KEY

  if (!FAL_KEY) {
    console.error('FAL_KEY not configured')
    return devFallback(prompt, finalPrompt)
  }

  // Provider 1: fal.ai FLUX.1 schnell (fastest)
  const schnellResult = await generateWithFalSchnell(FAL_KEY, finalPrompt, finalNegativePrompt)
  if (schnellResult.success) return schnellResult

  // Provider 2: fal.ai FLUX.1 dev (more robust)
  const devResult = await generateWithFalDev(FAL_KEY, finalPrompt, finalNegativePrompt)
  if (devResult.success) return devResult

  // Provider 3: Development placeholder
  return devFallback(prompt, finalPrompt)
}

async function generateWithFalSchnell(
  apiKey: string,
  prompt: string,
  negativePrompt: string
): Promise<DesignGenerationResult> {
  try {
    const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        image_size: 'square_hd',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
    })

    if (!response.ok) {
      console.error('fal.ai schnell error:', await response.text())
      return { success: false, error: 'schnell provider failed' }
    }

    const data = await response.json()

    if (data.has_nsfw_concepts?.some?.((v: boolean) => v)) {
      return { success: false, error: 'Design rejected by safety checker. Please modify your prompt.' }
    }

    const imageUrl = data.images?.[0]?.url
    if (!imageUrl) {
      return { success: false, error: 'No image in schnell response' }
    }

    return {
      success: true,
      imageUrl,
      prompt,
      seed: data.seed,
      timings: data.timings || { inference: 0 },
      provider: 'fal-schnell',
    }
  } catch (error) {
    console.error('fal.ai schnell error:', error)
    return { success: false, error: 'schnell provider error' }
  }
}

async function generateWithFalDev(
  apiKey: string,
  prompt: string,
  negativePrompt: string
): Promise<DesignGenerationResult> {
  try {
    const response = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        image_size: 'square_hd',
        num_inference_steps: 28,
        num_images: 1,
        enable_safety_checker: true,
      }),
    })

    if (!response.ok) {
      console.error('fal.ai dev error:', await response.text())
      return { success: false, error: 'dev provider failed' }
    }

    const data = await response.json()

    if (data.has_nsfw_concepts?.some?.((v: boolean) => v)) {
      return { success: false, error: 'Design rejected by safety checker. Please modify your prompt.' }
    }

    const imageUrl = data.images?.[0]?.url
    if (!imageUrl) {
      return { success: false, error: 'No image in dev response' }
    }

    return {
      success: true,
      imageUrl,
      prompt,
      seed: data.seed,
      timings: data.timings || { inference: 0 },
      provider: 'fal-dev',
    }
  } catch (error) {
    console.error('fal.ai dev error:', error)
    return { success: false, error: 'dev provider error' }
  }
}

function devFallback(originalPrompt: string, finalPrompt: string): DesignGenerationResult {
  if (process.env.NODE_ENV === 'development') {
    const placeholderUrl = `https://placehold.co/1024x1024/667eea/ffffff?text=${encodeURIComponent(originalPrompt.slice(0, 50))}`
    return {
      success: true,
      imageUrl: placeholderUrl,
      prompt: finalPrompt,
      seed: Math.floor(Math.random() * 1000000),
      timings: { inference: 0 },
      placeholder: true,
      note: 'Placeholder image - all providers failed',
      provider: 'placeholder',
    }
  }

  return {
    success: false,
    error: 'All design generation providers failed',
  }
}
