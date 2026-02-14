import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { z } from 'zod'

const saveDesignSchema = z.object({
  prompt: z.string().min(1),
  style: z.string().optional(),
  model: z.string().optional(),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  productId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
})

/**
 * GET /api/designs
 * Fetch user's generated designs
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Get user ID from session/auth
    // For now, fetch all designs (will add auth later)
    const userId = req.headers.get('x-user-id') // Placeholder for auth

    const query = supabaseAdmin
      .from('designs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    // If user ID is provided, filter by user
    if (userId) {
      query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch designs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch designs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      designs: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('GET /api/designs error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/designs
 * Save a generated design (automatically sets moderation_status='pending')
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = saveDesignSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const {
      prompt,
      style,
      model,
      imageUrl,
      thumbnailUrl,
      width,
      height,
      productId,
      userId,
    } = validation.data

    // Insert design with moderation_status='pending' (default in DB schema)
    const { data, error } = await supabaseAdmin
      .from('designs')
      .insert({
        prompt,
        style: style || null,
        model: model || null,
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl || null,
        width: width || null,
        height: height || null,
        product_id: productId || null,
        user_id: userId || null,
        // moderation_status defaults to 'pending' in DB schema
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save design:', error)
      return NextResponse.json(
        { error: 'Failed to save design', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      design: data,
    })
  } catch (error) {
    console.error('POST /api/designs error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
