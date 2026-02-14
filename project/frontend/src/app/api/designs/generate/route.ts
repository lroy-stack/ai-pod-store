import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateDesign } from '@/lib/design-generation'

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

    // Generate the design using shared utility
    const result = await generateDesign({ prompt, style, negativePrompt })

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
    })
  } catch (error) {
    console.error('POST /api/designs/generate error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
