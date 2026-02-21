/**
 * Product Personalization API
 *
 * POST /api/designs/personalize
 * Saves a text personalization to the database (draft status).
 * The actual Printify temp product is created at checkout time.
 *
 * AUTH: Anonymous users CAN personalize (user_id = null).
 * Authenticated users get their user_id linked automatically.
 * Only AI image generation (/api/designs/generate) requires auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase-server'
import { containsProfanity, getProfanityErrorMessage } from '@/lib/profanity-filter'

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

    // Validate line count and character limits
    const lines = text.split('\n');
    if (lines.length > 3) {
      return NextResponse.json(
        { error: 'Maximum 3 lines allowed' },
        { status: 400 }
      );
    }

    // Validate each line is max 50 characters
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 50) {
        return NextResponse.json(
          { error: `Line ${i + 1} exceeds 50 characters (${lines[i].length} chars)` },
          { status: 400 }
        );
      }
    }

    // Check for profanity (server-side validation)
    if (containsProfanity(text)) {
      return NextResponse.json(
        { error: getProfanityErrorMessage() },
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

    // Try to get authenticated user (optional — anonymous users can personalize)
    const { user } = await createServerClient(req)

    // Use admin client to insert (bypasses RLS so anonymous users can save)
    const adminClient = createAdminClient()

    // Verify product exists
    const { data: product, error: productError } = await adminClient
      .from('products')
      .select('id')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Save personalization to DB as draft
    // user_id is null for anonymous users, linked at checkout when they authenticate
    const { data: personalization, error: saveError } = await adminClient
      .from('personalizations')
      .insert({
        user_id: user?.id || null,
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
