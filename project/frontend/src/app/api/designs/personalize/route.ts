/**
 * Product Personalization API
 *
 * POST /api/designs/personalize
 * Saves a text personalization to the database (draft status).
 * The actual Printify temp product is created at checkout time.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      productId,
      variantId,
      text,
      font = 'Inter',
      fontColor = '#000000',
      fontSize = 'medium',
      position = 'bottom',
    } = body

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required for personalization' },
        { status: 400 }
      )
    }

    if (text.length > 50) {
      return NextResponse.json(
        { error: 'Text must be 50 characters or less' },
        { status: 400 }
      )
    }

    // Validate fontSize and position
    const validSizes = ['small', 'medium', 'large']
    const validPositions = ['top', 'center', 'bottom']
    if (!validSizes.includes(fontSize)) {
      return NextResponse.json({ error: 'Invalid fontSize' }, { status: 400 })
    }
    if (!validPositions.includes(position)) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    // Verify product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Get user ID from auth header if available
    let userId: string | null = null
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    // Save personalization to DB as draft (no Printify product yet)
    const { data: personalization, error: saveError } = await supabase
      .from('personalizations')
      .insert({
        user_id: userId,
        product_id: productId,
        variant_id: variantId || null,
        text_content: text.trim(),
        font_family: font,
        font_color: fontColor,
        font_size: fontSize,
        position: position,
        printify_temp_product_id: null,
        status: 'draft',
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('Failed to save personalization:', saveError)
      return NextResponse.json({ error: 'Failed to save personalization' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      personalizationId: personalization.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Personalization error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
