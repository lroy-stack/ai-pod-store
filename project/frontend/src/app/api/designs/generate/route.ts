import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const designRequestSchema = z.object({
  prompt: z.string().min(3, 'Prompt must be at least 3 characters'),
  style: z.string().optional(),
  negativePrompt: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json()
    const validation = designRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { prompt, style, negativePrompt } = validation.data

    // Call fal.ai API for image generation
    const FAL_KEY = process.env.FAL_KEY
    if (!FAL_KEY) {
      console.error('FAL_KEY not configured')
      return NextResponse.json(
        { error: 'Image generation service not configured' },
        { status: 500 }
      )
    }

    // Build the final prompt with style if provided
    const finalPrompt = style
      ? `${prompt}, ${style} style, high quality, professional design`
      : `${prompt}, high quality, professional design`

    const finalNegativePrompt =
      negativePrompt ||
      'blurry, low quality, watermark, text, signature, distorted, ugly'

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
        image_size: 'square_hd',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
    })

    if (!falResponse.ok) {
      const errorText = await falResponse.text()
      console.error('fal.ai API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to generate design', details: errorText },
        { status: 500 }
      )
    }

    const falData = await falResponse.json()

    // Extract the image URL from the response
    const imageUrl = falData.images?.[0]?.url

    if (!imageUrl) {
      console.error('No image URL in fal.ai response:', falData)
      return NextResponse.json(
        { error: 'No image generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      prompt: finalPrompt,
      seed: falData.seed,
      timings: falData.timings,
    })
  } catch (error) {
    console.error('Design generation error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
