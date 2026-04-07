import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthUser, requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { z } from 'zod'
import { designSaveLimiter } from '@/lib/rate-limit'

const saveDesignSchema = z.object({
  prompt: z.string().min(1),
  style: z.string().optional(),
  model: z.string().optional(),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  productId: z.string().uuid().optional(),
})

/**
 * GET /api/designs
 * Authenticated: returns user's own designs
 * Unauthenticated: returns only publicly approved designs
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    const { searchParams } = new URL(req.url)
    const singleId = searchParams.get('id')

    // Single design fetch by ID
    if (singleId) {
      const { data, error } = await supabaseAdmin
        .from('designs')
        .select('*')
        .eq('id', singleId)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 })
      }

      // Only owner or public approved designs
      if (data.user_id !== user?.id && !(data.privacy_level === 'public' && data.moderation_status === 'approved')) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 })
      }

      return NextResponse.json(data)
    }

    // List designs (only with valid image URLs)
    const query = supabaseAdmin
      .from('designs')
      .select('*')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!user) {
      // Unauthenticated: return empty — "My Designs" requires login
      return NextResponse.json({
        success: true,
        designs: [],
        count: 0,
        requiresAuth: true,
      })
    }

    // Authenticated: show only user's own designs
    query.eq('user_id', user.id)

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
        details: 'Failed to fetch designs',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/designs
 * Save a generated design (automatically sets moderation_status='pending')
 * User ID is derived from auth token, not from request body
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
    } = validation.data

    // Auth required for saving designs
    let user
    try {
      user = await requireAuth(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    // Rate limit check
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitKey = `design:save:${user.id || ip}`
    const { success } = designSaveLimiter.check(rateLimitKey)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

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
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save design:', error)
      return NextResponse.json(
        { error: 'Failed to save design', details: 'Failed to save design' },
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
        details: 'Failed to save design',
      },
      { status: 500 }
    )
  }
}
