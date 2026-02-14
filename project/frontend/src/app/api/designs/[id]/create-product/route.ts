/**
 * Design → Product Pipeline
 *
 * POST /api/designs/:id/create-product
 * Converts an approved design into a Printify product:
 *   1. Validate design is approved
 *   2. Upload image to Printify (if not already uploaded)
 *   3. Create product with the uploaded image
 *   4. Publish product
 *   5. Save printify_id to products table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { printify } from '@/lib/printify'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const CRON_SECRET = process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: require bearer token (called by PodClaw or cron)
  const authHeader = req.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: designId } = await params

  // 1. Fetch design
  const { data: design, error: designError } = await supabase
    .from('designs')
    .select('*')
    .eq('id', designId)
    .single()

  if (designError || !design) {
    return NextResponse.json({ error: 'Design not found' }, { status: 404 })
  }

  if (design.moderation_status !== 'approved') {
    return NextResponse.json(
      { error: `Design not approved (status: ${design.moderation_status})` },
      { status: 400 }
    )
  }

  // Parse request body for product config
  let body: {
    blueprint_id: number
    print_provider_id: number
    variants: Array<{ id: number; price: number; is_enabled: boolean }>
    title?: string
    description?: string
    tags?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body required with blueprint_id, print_provider_id, variants' },
      { status: 400 }
    )
  }

  if (!body.blueprint_id || !body.print_provider_id || !body.variants) {
    return NextResponse.json(
      { error: 'Missing required fields: blueprint_id, print_provider_id, variants' },
      { status: 400 }
    )
  }

  try {
    // 2. Upload image to Printify if not already uploaded
    let printifyUploadId = design.printify_upload_id
    if (!printifyUploadId) {
      const imageUrl = design.image_url || design.url
      if (!imageUrl) {
        return NextResponse.json({ error: 'Design has no image URL' }, { status: 400 })
      }

      const fileName = `design-${designId}.png`
      const uploadResult = await printify.uploadImage(imageUrl, fileName)
      printifyUploadId = uploadResult.id

      // Save upload ID to design
      await supabase
        .from('designs')
        .update({
          printify_upload_id: printifyUploadId,
          printify_image_url: uploadResult.preview_url,
        })
        .eq('id', designId)
    }

    // 3. Create product in Printify
    const productTitle = body.title || design.title || `Design ${designId.slice(0, 8)}`
    const productDescription = body.description || design.description || ''

    const printifyProduct = await printify.createProduct({
      title: productTitle,
      description: productDescription,
      blueprint_id: body.blueprint_id,
      print_provider_id: body.print_provider_id,
      variants: body.variants,
      print_areas: [
        {
          variant_ids: body.variants.map((v: { id: number }) => v.id),
          placeholders: [
            {
              position: 'front',
              images: [
                {
                  id: printifyUploadId,
                  x: 0.5,
                  y: 0.5,
                  scale: 1,
                  angle: 0,
                },
              ],
            },
          ],
        },
      ],
      tags: body.tags || [],
    })

    // 4. Publish product
    await printify.publishProduct(printifyProduct.id)

    // 5. Save to products table
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        title: productTitle,
        description: productDescription,
        printify_id: printifyProduct.id,
        design_id: designId,
        status: 'publishing',
        currency: 'eur',
      })
      .select()
      .single()

    if (productError) {
      console.error('Failed to save product to DB:', productError)
    }

    return NextResponse.json({
      success: true,
      printify_product_id: printifyProduct.id,
      product_id: product?.id,
      printify_upload_id: printifyUploadId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Design→Product pipeline error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
