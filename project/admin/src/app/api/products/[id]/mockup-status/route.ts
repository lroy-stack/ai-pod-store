import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (
  req: NextRequest,
  _session: unknown,
  context?: { params?: Promise<{ id: string }> }
) => {
  try {
    const params = await context?.params
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }

    // Get product slug (needed for storage path)
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, slug')
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const slug = product.slug

    // List files in designs/mockups/{slug}/ bucket path
    let mockupCount = 0
    if (slug) {
      const { data: files, error: storageError } = await supabaseAdmin.storage
        .from('designs')
        .list(`mockups/${slug}`, { limit: 1000 })

      if (!storageError && files) {
        // Filter out placeholder/empty entries
        mockupCount = files.filter((f) => f.name && !f.name.startsWith('.')).length
      }
    }

    return NextResponse.json({
      product_id: id,
      slug,
      mockup_count: mockupCount,
      has_mockups: mockupCount > 0,
    })
  } catch (err) {
    console.error('Error fetching mockup status:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
