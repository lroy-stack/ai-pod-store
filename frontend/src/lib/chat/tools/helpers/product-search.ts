/**
 * Product search and formatting helpers for chat tools.
 *
 * Reusable by any tool that needs to search, format, or enrich products.
 * Uses full-text search (wfts) for name matching — handles punctuation,
 * accents, and special characters correctly.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FormattedProduct } from '../types'
import { sanitizeForLike, sanitizeForPostgrest } from '@/lib/query-sanitizer'

/** Format a raw product row into the shape returned by search/browse tools */
export function formatProduct(p: any): FormattedProduct {
  return {
    id: p.id,
    title: p.title,
    description: p.description?.substring(0, 150) + (p.description?.length > 150 ? '...' : ''),
    category: (p.categories as any)?.slug || 'other',
    price: p.base_price_cents / 100,
    compareAtPrice: p.compare_at_price_cents ? p.compare_at_price_cents / 100 : undefined,
    currency: p.currency?.toUpperCase() || 'EUR',
    image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : null,
    rating: p.avg_rating || 0,
    reviewCount: p.review_count || 0,
  }
}

/** Batch-fetch product_variants and attach sizes/colors/colorImages to formatted products */
export async function enrichWithVariants(
  supabase: SupabaseClient,
  products: FormattedProduct[]
): Promise<FormattedProduct[]> {
  if (products.length === 0) return products

  const ids = products.map((p) => p.id)
  const { data: variants } = await supabase
    .from('product_variants')
    .select('product_id, size, color, image_url')
    .in('product_id', ids)
    .eq('is_enabled', true)
    .eq('is_available', true)

  if (!variants || variants.length === 0) return products

  const grouped = new Map<string, { sizes: Set<string>; colors: Set<string>; colorImages: Map<string, string> }>()
  for (const v of variants) {
    if (!grouped.has(v.product_id)) {
      grouped.set(v.product_id, { sizes: new Set(), colors: new Set(), colorImages: new Map() })
    }
    const entry = grouped.get(v.product_id)!
    if (v.size) entry.sizes.add(v.size)
    if (v.color) {
      entry.colors.add(v.color)
      if (v.image_url && !entry.colorImages.has(v.color)) {
        entry.colorImages.set(v.color, v.image_url)
      }
    }
  }

  return products.map((p) => {
    const g = grouped.get(p.id)
    if (!g) return p
    return {
      ...p,
      variants: {
        sizes: [...g.sizes],
        colors: [...g.colors],
        colorImages: Object.fromEntries(g.colorImages),
      },
    }
  })
}

/**
 * Search for a product by name using full-text search (wfts).
 * Handles punctuation, accents, and special characters correctly.
 * Falls back to ILIKE if wfts finds nothing.
 */
export async function searchProductByName(
  supabase: SupabaseClient,
  name: string
): Promise<any | null> {
  // Try full-text search first (handles apostrophes, accents)
  const sanitizedWfts = sanitizeForPostgrest(name)
  if (sanitizedWfts) {
    const { data } = await supabase
      .from('products')
      .select('*, categories(slug)')
      .eq('status', 'active')
      .is('deleted_at', null)
      .or(`title.wfts.${sanitizedWfts},description.wfts.${sanitizedWfts}`)
      .limit(1)
      .single()
    if (data) return data
  }

  // Fallback: ILIKE with wildcards (less precise but catches partial matches)
  const sanitizedIlike = sanitizeForLike(name, 'both')
  if (sanitizedIlike) {
    const { data } = await supabase
      .from('products')
      .select('*, categories(slug)')
      .eq('status', 'active')
      .is('deleted_at', null)
      .or(`title.ilike.${sanitizedIlike},description.ilike.${sanitizedIlike}`)
      .limit(1)
      .single()
    if (data) return data
  }

  return null
}

/** Fetch top-rated suggestions + available categories when a search returns 0 results */
export async function getSearchFallback(supabase: SupabaseClient) {
  const [catResult, sugResult] = await Promise.all([
    supabase.from('products').select('category_id, categories(slug)').eq('status', 'active'),
    supabase
      .from('products')
      .select('id, title, description, category_id, categories(slug), base_price_cents, compare_at_price_cents, currency, images, avg_rating, review_count')
      .eq('status', 'active')
      .order('avg_rating', { ascending: false })
      .limit(4),
  ])

  const categoryCounts: Record<string, number> = {}
  for (const p of catResult.data || []) {
    const cat = (p.categories as any)?.slug || 'other'
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  }

  return {
    suggestions: (sugResult.data || []).map(formatProduct),
    availableCategories: Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
  }
}

/**
 * Filter product images to only include enabled color variants.
 * Uses "/{color-slug}[-.]" regex to avoid substring collisions
 * (e.g., "black" in "vintage-black").
 */
export function filterImagesByEnabledColors(
  images: any[],
  enabledColors: string[]
): any[] {
  if (enabledColors.length === 0) return images

  const slugs = enabledColors.map(c => c.toLowerCase().replace(/\s+/g, '-'))
  const filtered = images.filter((img: any) => {
    const src = (img.src || img.url || img || '').toLowerCase()
    return slugs.some(slug => {
      const pattern = new RegExp(`/${slug}[-.]`)
      return pattern.test(src)
    })
  })

  // Fallback: if filtering removed everything, return first 3 images
  return filtered.length > 0 ? filtered : images.slice(0, 3)
}
