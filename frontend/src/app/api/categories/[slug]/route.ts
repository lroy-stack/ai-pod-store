import { NextRequest, NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase-anon'
import { getCorsHeaders, handleCorsPrelight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

/**
 * OPTIONS /api/categories/[slug]
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS(req: Request) {
  const preflightResponse = handleCorsPrelight(req)
  return preflightResponse || new Response(null, { status: 405 })
}

/**
 * GET /api/categories/[slug]
 *
 * Returns a single category by slug with product count and localized name
 *
 * Query parameters:
 * - locale: Language code (en, es, de) - defaults to 'en'
 *
 * Response format:
 * {
 *   id: string,
 *   slug: string,
 *   name: string (localized),
 *   icon: string,
 *   image_url: string | null,
 *   parent_id: string | null,
 *   product_count: number,
 *   sort_order: number
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(req.url)
    const locale = searchParams.get('locale') || 'en'
    const origin = req.headers.get('origin')

    // Validate locale
    const validLocales = ['en', 'es', 'de']
    const normalizedLocale = validLocales.includes(locale) ? locale : 'en'

    // Fetch the category by slug
    const { data: category, error: categoryError } = await supabaseAnon
      .from('categories')
      .select('id, slug, parent_id, name_en, name_es, name_de, icon, image_url, sort_order')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (categoryError || !category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      )
    }

    // Count products in this category
    const { count, error: countError } = await supabaseAnon
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category', slug)
      .eq('status', 'active')

    if (countError) {
      console.error('Error counting products:', countError)
      return NextResponse.json(
        { error: 'Failed to count products' },
        { status: 500, headers: getCorsHeaders(origin) }
      )
    }

    // Build response with localized name and product count
    const nameField = `name_${normalizedLocale}` as 'name_en' | 'name_es' | 'name_de'
    const response = {
      id: category.id,
      slug: category.slug,
      name: category[nameField] || category.name_en, // Fallback to English
      icon: category.icon,
      image_url: category.image_url,
      parent_id: category.parent_id,
      product_count: count || 0,
      sort_order: category.sort_order,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: getCorsHeaders(origin),
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/categories/[slug]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
