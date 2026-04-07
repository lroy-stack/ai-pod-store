import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminSession } from '@/lib/rbac'
import { sanitizeSearch } from '@/lib/query-sanitizer'

export async function GET(request: NextRequest) {
  // Check admin authentication
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const rawSearch = searchParams.get('search') || ''
    const search = rawSearch ? sanitizeSearch(rawSearch) : ''
    const offset = (page - 1) * limit

    let query = supabase
      .from('designs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filter by status if provided
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query = query.eq('moderation_status', status)
    }

    // Filter by search if provided
    if (search) {
      query = query.or(`prompt.ilike.%${search}%,style.ilike.%${search}%`)
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch designs' },
        { status: 500 }
      )
    }

    const designs = data || []

    // Compute used_in_count: count products that reference each design's image_url
    const usedInMap: Record<string, number> = {}
    if (designs.length > 0) {
      const imageUrls = designs
        .map((d: { image_url: string | null }) => d.image_url)
        .filter(Boolean) as string[]
      if (imageUrls.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('images')
          .not('images', 'is', null)
        if (products) {
          for (const product of products) {
            const imgs: Array<{ src?: string }> = product.images || []
            for (const img of imgs) {
              if (img.src && imageUrls.includes(img.src)) {
                usedInMap[img.src] = (usedInMap[img.src] || 0) + 1
              }
            }
          }
        }
      }
    }

    const enrichedDesigns = designs.map((d: { image_url: string | null }) => ({
      ...d,
      used_in_count: d.image_url ? (usedInMap[d.image_url] || 0) : 0,
    }))

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      designs: enrichedDesigns,
      total,
      page,
      limit,
      totalPages,
    })
  } catch (error) {
    console.error('Error fetching designs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
