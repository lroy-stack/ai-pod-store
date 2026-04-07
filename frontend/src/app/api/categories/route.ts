import { NextRequest, NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase-anon'
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
    const { data: categories, error: categoriesError } = await supabaseAnon
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

    // Fetch product counts by category_id FK (not legacy VARCHAR)
    const { data: productCounts, error: countError } = await supabaseAnon
      .from('products')
      .select('category_id')
      .eq('status', 'active')
      .not('category_id', 'is', null)

    if (countError) {
      console.error('Error fetching product counts:', countError)
      return NextResponse.json(
        { error: 'Failed to fetch product counts' },
        { status: 500, headers: getCorsHeaders(origin) }
      )
    }

    // Build a map of category_id -> direct product count
    const countMap = new Map<string, number>()
    if (productCounts) {
      for (const product of productCounts) {
        if (product.category_id) {
          countMap.set(product.category_id, (countMap.get(product.category_id) || 0) + 1)
        }
      }
    }

    // Build parent->children map for hierarchical counting
    const childrenMap = new Map<string, typeof categories>()
    for (const cat of categories) {
      if (cat.parent_id) {
        const siblings = childrenMap.get(cat.parent_id) || []
        siblings.push(cat)
        childrenMap.set(cat.parent_id, siblings)
      }
    }

    // Calculate hierarchical count (own + children's products)
    function getTotalCount(catId: string): number {
      const ownCount = countMap.get(catId) || 0
      const children = childrenMap.get(catId) || []
      const childCount = children.reduce((sum, c) => sum + (countMap.get(c.id) || 0), 0)
      return ownCount + childCount
    }

    // Build response with localized names, hierarchical counts, and children
    const nameField = `name_${normalizedLocale}` as 'name_en' | 'name_es' | 'name_de'
    const response = categories
      .filter((cat) => !cat.parent_id) // Only return top-level categories
      .map((cat) => {
        const children = (childrenMap.get(cat.id) || [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((child) => ({
            id: child.id,
            slug: child.slug,
            name: child[nameField] || child.name_en,
            icon: child.icon,
            product_count: countMap.get(child.id) || 0,
            sort_order: child.sort_order,
          }))

        return {
          id: cat.id,
          slug: cat.slug,
          name: cat[nameField] || cat.name_en,
          icon: cat.icon,
          image_url: cat.image_url,
          parent_id: cat.parent_id,
          product_count: countMap.get(cat.id) || 0,
          total_product_count: getTotalCount(cat.id),
          sort_order: cat.sort_order,
          children,
        }
      })

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
