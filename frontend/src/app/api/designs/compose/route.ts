/**
 * Design Composition API
 *
 * POST /api/designs/compose
 * Creates a design composition from multiple layers, generates a preview,
 * and stores the composition in the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { renderCompositionPreview, type CompositionLayer } from '@/lib/composition-renderer'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { composeLimiter } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────
    let user
    try {
      user = await requireAuth(request)
    } catch (error) {
      return authErrorResponse(error)
    }

    // ── Rate limiting: 10 compositions per minute per user ─────────
    const rateLimitKey = `design:compose:${user.id}`
    const rateLimitResult = composeLimiter.check(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum 10 compositions per minute. Please wait and try again.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'Retry-After': '60',
          }
        }
      )
    }

    // ── Parse body ──────────────────────────────────────────────────
    const body = await request.json()
    const {
      layers,
      product_type,
      product_id,
    }: {
      layers: CompositionLayer[]
      product_type: string
      product_id?: string
    } = body

    // ── Validate ────────────────────────────────────────────────────
    if (!layers || !Array.isArray(layers) || layers.length === 0) {
      return NextResponse.json(
        { error: 'At least one layer is required' },
        { status: 400 }
      )
    }

    if (!product_type || typeof product_type !== 'string') {
      return NextResponse.json(
        { error: 'product_type is required' },
        { status: 400 }
      )
    }

    // Validate layer structure
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]
      if (!layer.type || !['text', 'image', 'ai'].includes(layer.type)) {
        return NextResponse.json(
          { error: `Invalid layer type at index ${i}: must be 'text', 'image', or 'ai'` },
          { status: 400 }
        )
      }
      if ((layer.type === 'image' || layer.type === 'ai') && !layer.url) {
        return NextResponse.json(
          { error: `Layer ${i} (${layer.type}) requires a url` },
          { status: 400 }
        )
      }
      if (layer.type === 'text' && !layer.text) {
        return NextResponse.json(
          { error: `Layer ${i} (text) requires text content` },
          { status: 400 }
        )
      }
    }

    // Validate product_id exists if provided
    if (product_id) {
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('id', product_id)
        .is('deleted_at', null)
        .single()

      if (!product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
    }

    // ── Render preview ──────────────────────────────────────────────
    const previewBuffer = await renderCompositionPreview(layers, product_type)

    // ── Upload preview to Supabase Storage ──────────────────────────
    const compositionId = crypto.randomUUID()
    const filename = `compositions/${compositionId}/preview.png`
    let previewUrl: string

    const { error: uploadError } = await supabaseAdmin.storage
      .from('designs')
      .upload(filename, previewBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('Preview upload error:', uploadError)
      // Fallback to base64 data URL
      const base64 = previewBuffer.toString('base64')
      previewUrl = `data:image/png;base64,${base64}`
    } else {
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('designs')
        .getPublicUrl(filename)
      previewUrl = publicUrl
    }

    // ── Create DB row ───────────────────────────────────────────────
    const { data: composition, error: insertError } = await supabaseAdmin
      .from('design_compositions')
      .insert({
        id: compositionId,
        user_id: user.id,
        product_type,
        product_id: product_id || null,
        schema_version: 1,
        layers,
        preview_url: previewUrl,
        status: 'draft',
      })
      .select('id, preview_url, status, created_at')
      .single()

    if (insertError) {
      console.error('Composition insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save composition', message: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      composition_id: composition.id,
      preview_url: composition.preview_url,
    })
  } catch (error) {
    console.error('Designs compose API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
