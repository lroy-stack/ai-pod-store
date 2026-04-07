import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { composeLimiter } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    let user
    try {
      user = await requireAuth(request)
    } catch (error) {
      return authErrorResponse(error)
    }

    // Rate limiting: 10 compositions per minute per user
    const rateLimitKey = `design:compose-v2:${user.id}`
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

    const body = await request.json()
    const { fabricJson, previewDataUrl, productType, productId, compositionId, productionPanels } = body

    if (!fabricJson || !productId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const id = compositionId || crypto.randomUUID()

    // If updating existing composition, verify ownership
    if (compositionId) {
      const { data: existing } = await supabaseAdmin
        .from('design_compositions')
        .select('user_id')
        .eq('id', compositionId)
        .single()
      if (existing && existing.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Upload preview image to Supabase Storage
    let previewUrl: string | null = null
    if (previewDataUrl && previewDataUrl.startsWith('data:image/png;base64,')) {
      const base64Data = previewDataUrl.replace(/^data:image\/png;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')

      const filename = `compositions/${user.id}/${id}/preview.png`
      const { error: uploadError } = await supabaseAdmin.storage
        .from('designs')
        .upload(filename, buffer, {
          contentType: 'image/png',
          cacheControl: '31536000',
          upsert: true,
        })

      if (!uploadError) {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('designs')
          .getPublicUrl(filename)
        previewUrl = publicUrl
      }
    }

    // Upload production PNGs per panel to Supabase Storage
    let productionUrl: string | null = null
    if (productionPanels && typeof productionPanels === 'object') {
      const prodUrlMap: Record<string, string> = {}

      for (const [panel, dataUrl] of Object.entries(productionPanels)) {
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) continue
        const base64Data = (dataUrl as string).replace(/^data:image\/png;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')

        const filename = `compositions/${user.id}/${id}/production-${panel}.png`
        const { error: uploadError } = await supabaseAdmin.storage
          .from('designs')
          .upload(filename, buffer, {
            contentType: 'image/png',
            cacheControl: '31536000',
            upsert: true,
          })

        if (!uploadError) {
          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('designs')
            .getPublicUrl(filename)
          prodUrlMap[panel] = publicUrl
        }
      }

      const panelKeys = Object.keys(prodUrlMap)
      if (panelKeys.length === 1) {
        // Single panel: store URL directly
        productionUrl = prodUrlMap[panelKeys[0]]
      } else if (panelKeys.length > 1) {
        // Multi-panel: store as JSON string
        productionUrl = JSON.stringify(prodUrlMap)
      }
    }

    // Upsert composition record
    const upsertData: Record<string, unknown> = {
      id,
      user_id: user.id,
      schema_version: fabricJson?.schema_version || 2,
      layers: fabricJson,
      product_type: productType || 'tshirt',
      product_id: productId,
      preview_url: previewUrl,
      status: 'draft',
      updated_at: new Date().toISOString(),
    }
    if (productionUrl) {
      upsertData.production_url = productionUrl
    }

    const { error: dbError } = await supabaseAdmin
      .from('design_compositions')
      .upsert(upsertData, { onConflict: 'id' })

    if (dbError) {
      console.error('Failed to save composition:', dbError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      composition_id: id,
      preview_url: previewUrl,
      production_url: productionUrl,
    })
  } catch (error) {
    console.error('compose-v2 error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
