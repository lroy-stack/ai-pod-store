import { NextRequest, NextResponse } from 'next/server'
import { invalidateProductCache, invalidateBrandCache, invalidateAllCaches } from '@/lib/cached-queries'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/cache-invalidate
 *
 * Invalidates Redis cache entries. Protected by API key.
 *
 * Body: { type: 'product-sync' | 'brand-update' | 'full', product_id?: string }
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.CACHE_INVALIDATE_API_KEY

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, product_id } = body

    switch (type) {
      case 'product-sync':
        await invalidateProductCache(product_id)
        break
      case 'brand-update':
        await invalidateBrandCache()
        break
      case 'full':
        await invalidateAllCaches()
        break
      default:
        return NextResponse.json({ error: `Unknown invalidation type: ${type}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true, type, product_id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
