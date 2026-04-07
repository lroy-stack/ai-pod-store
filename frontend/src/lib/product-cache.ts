import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** Extract image URL from images array — handles both string[] and {src}[] formats */
export function extractImageUrl(images: unknown, index = 0): string | null {
  if (!Array.isArray(images) || images.length === 0) return null
  const item = images[index] ?? images[0]
  if (!item) return null
  if (typeof item === 'string') return item
  if (typeof item === 'object' && item !== null) return (item as any).src || (item as any).url || null
  return null
}

// Get all active products from Supabase (React.cache deduplicates within same request)
export const getCatalogProducts = cache(async function getCatalogProducts() {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, slug, title, description, category, tags, base_price_cents, currency, images, avg_rating, review_count, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching catalog products:', error)
    return []
  }

  return (products || []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    price: p.base_price_cents / 100,
    currency: p.currency?.toUpperCase() || 'EUR',
    image: extractImageUrl(p.images, 0),
    rating: Number(p.avg_rating) || 0,
    reviewCount: p.review_count || 0,
    category: p.category?.toLowerCase(),
    createdAt: p.created_at,
  }))
})

// Get product categories (React.cache deduplicates within same request)
export const getProductCategories = cache(async function getProductCategories() {
  const products = await getCatalogProducts()
  const categories = Array.from(new Set(products.map((p) => p.category)))
  return ['all', ...categories]
})

// Get product count per category (React.cache deduplicates within same request)
export const getCategoryProductCount = cache(async function getCategoryProductCount(category: string) {
  const products = await getCatalogProducts()
  if (category === 'all') {
    return products.length
  }
  return products.filter((p) => p.category === category).length
})
