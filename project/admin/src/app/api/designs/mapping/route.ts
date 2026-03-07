import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminSession } from '@/lib/rbac'

/**
 * GET /api/designs/mapping
 * Returns a mapping of design image_url -> product count
 * Used by the designs DataTable to show "Used In" counts
 */
export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Fetch all designs with image_url
    const { data: designs, error: designsError } = await supabase
      .from('designs')
      .select('id, image_url')
      .not('image_url', 'is', null)

    if (designsError) {
      return NextResponse.json({ error: 'Failed to fetch designs' }, { status: 500 })
    }

    // Fetch all products with their images JSONB
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, title, images')
      .not('images', 'is', null)

    if (productsError) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Build map: image_url -> list of product {id, title}
    const imageToProducts: Record<string, Array<{ id: string; title: string }>> = {}

    for (const product of products || []) {
      const imgs: Array<{ src?: string }> = product.images || []
      for (const img of imgs) {
        if (img.src) {
          if (!imageToProducts[img.src]) imageToProducts[img.src] = []
          imageToProducts[img.src].push({ id: product.id, title: product.title })
        }
      }
    }

    // Build per-design mapping
    const mapping: Record<string, { count: number; products: Array<{ id: string; title: string }> }> = {}
    for (const design of designs || []) {
      if (design.image_url) {
        const linked = imageToProducts[design.image_url] || []
        mapping[design.id] = { count: linked.length, products: linked }
      }
    }

    return NextResponse.json({ mapping })
  } catch (error) {
    console.error('Error fetching designs mapping:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
