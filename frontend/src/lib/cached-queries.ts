/**
 * Redis-backed caching layer for public data queries.
 *
 * In production with REDIS_URL configured, responses are cached in Redis
 * with configurable TTLs. In local dev without Redis, falls through to
 * direct Supabase queries (zero overhead — getCached returns null).
 */

import { getCached, setCached, deleteCached, clearPattern } from '@/lib/redis'
import { supabaseAdmin } from '@/lib/supabase-admin'

// --- Cache TTLs (seconds) ---
const TTL = {
  PRODUCTS: 300,        // 5 min
  CATEGORY_COUNTS: 600, // 10 min
  CATEGORY_TREE: 600,   // 10 min
  BRAND_CONFIG: 1800,   // 30 min
  PRODUCT_DETAIL: 300,  // 5 min
  RELATED: 900,         // 15 min
} as const

// --- Products catalog (paginated, filtered, sorted) ---

interface ProductQueryParams {
  category?: string
  sort?: string
  page?: number
  limit?: number
  query?: string
  newArrivals?: boolean
}

export async function getCachedProducts(params: ProductQueryParams) {
  // Don't cache search queries (too many permutations)
  if (params.query?.trim()) return null

  const key = `products:${params.category || 'all'}:${params.sort || 'featured'}:${params.page || 1}:${params.limit || 20}`
  const cached = await getCached(key)
  if (cached) return cached as { data: any[]; count: number }

  return null // Caller falls through to direct query, then calls setCachedProducts
}

export async function setCachedProducts(params: ProductQueryParams, result: { data: any[]; count: number }) {
  if (params.query?.trim()) return // Don't cache search queries

  const key = `products:${params.category || 'all'}:${params.sort || 'featured'}:${params.page || 1}:${params.limit || 20}`
  await setCached(key, result, TTL.PRODUCTS)
}

// --- Category counts ---

export async function getCachedCategoryCounts(): Promise<Record<string, number> | null> {
  return getCached('categories:counts') as Promise<Record<string, number> | null>
}

export async function setCachedCategoryCounts(counts: Record<string, number>) {
  await setCached('categories:counts', counts, TTL.CATEGORY_COUNTS)
}

// --- Category tree (hierarchical with preview images) ---

export async function getCachedCategoryTree() {
  return getCached('categories:tree')
}

export async function setCachedCategoryTree(tree: any) {
  await setCached('categories:tree', tree, TTL.CATEGORY_TREE)
}

// --- Brand config ---

export async function getCachedBrandConfig() {
  return getCached('brand:config')
}

export async function setCachedBrandConfig(config: any) {
  await setCached('brand:config', config, TTL.BRAND_CONFIG)
}

// --- Product detail ---

export async function getCachedProductDetail(slug: string) {
  return getCached(`product:slug:${slug}`)
}

export async function setCachedProductDetail(slug: string, product: any) {
  await setCached(`product:slug:${slug}`, product, TTL.PRODUCT_DETAIL)
}

// --- Related products ---

export async function getCachedRelatedProducts(id: string) {
  return getCached(`related:${id}`)
}

export async function setCachedRelatedProducts(id: string, products: any[]) {
  await setCached(`related:${id}`, products, TTL.RELATED)
}

// --- Cache invalidation ---

export async function invalidateProductCache(productId?: string) {
  // Clear all product list caches
  await clearPattern('products:*')
  // Clear category caches
  await deleteCached('categories:counts')
  await deleteCached('categories:tree')
  // Clear specific product if provided (by UUID — clears related, slug cache cleared via pattern)
  if (productId) {
    await clearPattern('product:slug:*')
    await deleteCached(`related:${productId}`)
  }
}

export async function invalidateBrandCache() {
  await deleteCached('brand:config')
}

export async function invalidateAllCaches() {
  await clearPattern('products:*')
  await clearPattern('product:slug:*')
  await clearPattern('related:*')
  await deleteCached('categories:counts')
  await deleteCached('categories:tree')
  await deleteCached('brand:config')
}
