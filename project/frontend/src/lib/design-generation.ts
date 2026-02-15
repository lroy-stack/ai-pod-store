/**
 * Shared design generation logic
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
}

/**
 * Estimate cost of a design generation.
 */
export function estimateDesignCost(options?: { style?: string }): { credits: number; estimatedCostEur: number } {
  // Base: 1 credit per standard generation
  return { credits: 1, estimatedCostEur: 0.05 }
}

/**
 * Generate a design using fal.ai FLUX.1
 * Falls back to placeholder image in development if API fails
 */
export async function generateDesign(
  params: DesignGenerationParams
): Promise<DesignGenerationResult> {
  const prompt = params.prompt || 'custom design'
  const { style, negativePrompt } = params

  const FAL_KEY = process.env.FAL_KEY
  if (!FAL_KEY) {
    console.error('FAL_KEY not configured')

    // Development fallback
    if (process.env.NODE_ENV === 'development') {
      const placeholderUrl = `https://placehold.co/1024x1024/667eea/ffffff?text=${encodeURIComponent(prompt.slice(0, 50))}`
      return {
        success: true,
        imageUrl: placeholderUrl,
        prompt: `${prompt}, high quality, professional design`,
        seed: Math.floor(Math.random() * 1000000),
        timings: { inference: 0 },
        placeholder: true,
        note: 'Placeholder image - fal.ai credits exhausted',
      }
    }

    return {
      success: false,
      error: 'Image generation service not configured',
    }
  }

  // Build the final prompt with style if provided
  const finalPrompt = style
    ? `${prompt}, ${style} style, high quality, professional design`
    : `${prompt}, high quality, professional design`

  const finalNegativePrompt =
    negativePrompt ||
    'blurry, low quality, watermark, text, signature, distorted, ugly'

  try {
    // Call fal.ai FLUX.1 schnell model (fastest)
    const falResponse = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        negative_prompt: finalNegativePrompt,
        image_size: 'square_hd', // 1024x1024
        num_inference_steps: 4, // schnell is optimized for 4 steps
        num_images: 1,
        enable_safety_checker: true,
      }),
    })

    if (!falResponse.ok) {
      const errorText = await falResponse.text()
      console.error('fal.ai API error:', errorText)

      // Development fallback
      if (process.env.NODE_ENV === 'development') {
        const placeholderUrl = `https://placehold.co/1024x1024/667eea/ffffff?text=${encodeURIComponent(prompt.slice(0, 50))}`
        return {
          success: true,
          imageUrl: placeholderUrl,
          prompt: finalPrompt,
          seed: Math.floor(Math.random() * 1000000),
          timings: { inference: 0 },
          placeholder: true,
          note: 'Placeholder image - fal.ai credits exhausted',
        }
      }

      return {
        success: false,
        error: 'Failed to generate image',
      }
    }

    const falData = await falResponse.json()

    // Check if fal.ai safety checker rejected the image
    if (falData.has_nsfw_concepts?.some?.((v: boolean) => v)) {
      console.warn('[ContentSafety] fal.ai rejected design for NSFW content:', prompt)
      return {
        success: false,
        error: 'Design rejected by safety checker. Please modify your prompt.',
      }
    }

    // Extract the generated image URL
    const imageUrl = falData.images?.[0]?.url
    if (!imageUrl) {
      console.error('No image URL in fal.ai response:', falData)

      // Development fallback
      if (process.env.NODE_ENV === 'development') {
        const placeholderUrl = `https://placehold.co/1024x1024/667eea/ffffff?text=${encodeURIComponent(prompt.slice(0, 50))}`
        return {
          success: true,
          imageUrl: placeholderUrl,
          prompt: finalPrompt,
          seed: Math.floor(Math.random() * 1000000),
          timings: { inference: 0 },
          placeholder: true,
          note: 'Placeholder image - fal.ai credits exhausted',
        }
      }

      return {
        success: false,
        error: 'No image generated',
      }
    }

    return {
      success: true,
      imageUrl,
      prompt: finalPrompt,
      seed: falData.seed,
      timings: falData.timings || { inference: 0 },
    }
  } catch (error) {
    console.error('Design generation error:', error)

    // Development fallback
    if (process.env.NODE_ENV === 'development') {
      const placeholderUrl = `https://placehold.co/1024x1024/667eea/ffffff?text=${encodeURIComponent(prompt.slice(0, 50))}`
      return {
        success: true,
        imageUrl: placeholderUrl,
        prompt: finalPrompt,
        seed: Math.floor(Math.random() * 1000000),
        timings: { inference: 0 },
        placeholder: true,
        note: 'Placeholder image - fal.ai credits exhausted',
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
