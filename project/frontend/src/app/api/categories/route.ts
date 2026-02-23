import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCorsHeaders, handleCorsPrelight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

/**
 * OPTIONS /api/categories
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS(req: Request) {
  const preflightResponse = handleCorsPrelight(req)
  return preflightResponse || new Response(null, { status: 405 })
}

/**
 * GET /api/categories
 *
 * Returns all active categories with product counts and localized names
 *
 * Query parameters:
 * - locale: Language code (en, es, de) - defaults to 'en'
 *
 * Response format:
 * [
 *   {
 *     id: string,
 *     slug: string,
 *     name: string (localized),
 *     icon: string,
 *     image_url: string | null,
 *     parent_id: string | null,
 *     product_count: number,
 *     sort_order: number
 *   }
 * ]
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const locale = searchParams.get('locale') || 'en'
    const origin = req.headers.get('origin')

    // Validate locale
    const validLocales = ['en', 'es', 'de']
    const normalizedLocale = validLocales.includes(locale) ? locale : 'en'

    // Fetch all active categories
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from('categories')
      .select('id, slug, parent_id, name_en, name_es, name_de, icon, image_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError)
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500, headers: getCorsHeaders(origin) }
      )
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json([], { status: 200, headers: getCorsHeaders(origin) })
    }

    // Fetch product counts for each category (grouped by category slug)
    const { data: productCounts, error: countError } = await supabaseAdmin
      .from('products')
      .select('category')
      .eq('status', 'active')

    if (countError) {
      console.error('Error fetching product counts:', countError)
      return NextResponse.json(
        { error: 'Failed to fetch product counts' },
        { status: 500, headers: getCorsHeaders(origin) }
      )
    }

    // Build a map of category slug -> product count
    const countMap = new Map<string, number>()
    if (productCounts) {
      for (const product of productCounts) {
        const category = product.category
        if (category) {
          countMap.set(category, (countMap.get(category) || 0) + 1)
        }
      }
    }

    // Build response with localized names and product counts
    const nameField = `name_${normalizedLocale}` as 'name_en' | 'name_es' | 'name_de'
    const response = categories.map((cat) => ({
      id: cat.id,
      slug: cat.slug,
      name: cat[nameField] || cat.name_en, // Fallback to English
      icon: cat.icon,
      image_url: cat.image_url,
      parent_id: cat.parent_id,
      product_count: countMap.get(cat.slug) || 0,
      sort_order: cat.sort_order,
    }))

    return NextResponse.json(response, {
      status: 200,
      headers: getCorsHeaders(origin),
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/categories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
