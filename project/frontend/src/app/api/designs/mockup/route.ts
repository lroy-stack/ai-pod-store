import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateMockup } from '@/lib/mockup-generator'

const mockupRequestSchema = z.object({
  designUrl: z.string().url('Invalid design URL'),
  productType: z.enum(['tshirt', 'hoodie', 'mug', 'phone-case', 'tote-bag']),
  color: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
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

    // Generate the mockup
    const result = await generateMockup({ designUrl, productType, color })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate mockup' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      mockupUrl: result.mockupUrl,
      productType,
      placeholder: result.placeholder,
    })
  } catch (error) {
    console.error('POST /api/designs/mockup error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
