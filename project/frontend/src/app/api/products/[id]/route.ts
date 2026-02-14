import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .single()

    if (error || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Map DB schema to frontend format
    const mapped = {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.base_price_cents / 100,
      currency: product.currency?.toUpperCase() || 'EUR',
      image: Array.isArray(product.images) && product.images.length > 0 ? (product.images[0].src || product.images[0].url) : null,
      images: Array.isArray(product.images) ? product.images.map((img: { src?: string; url?: string; alt?: string }) => img.src || img.url || '') : [],
      rating: Number(product.avg_rating) || 0,
      reviewCount: product.review_count || 0,
      category: product.category?.toLowerCase(),
      tags: product.tags || [],
      inStock: true,
      printifyId: product.printify_id,
      createdAt: product.created_at,
    }

    return NextResponse.json({ success: true, product: mapped })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}
