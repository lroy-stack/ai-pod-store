/**
 * Client-side in-memory product cache.
 * Prevents duplicate API calls when the same product is opened
 * multiple times within a session (e.g., switching tabs, re-clicking).
 *
 * TTL: 5 minutes. Max entries: 50 (LRU eviction).
 */

import type { ProductDetail } from '@/types/product'

interface CacheEntry {
  data: ProductDetail
  timestamp: number
}

const TTL = 5 * 60 * 1000 // 5 minutes
const MAX_ENTRIES = 50

const cache = new Map<string, CacheEntry>()

export function getCachedProduct(id: string): ProductDetail | null {
  const entry = cache.get(id)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(id)
    return null
  }
  // Move to end (most recently accessed) for LRU
  cache.delete(id)
  cache.set(id, entry)
  return entry.data
}

export function setCachedProduct(id: string, data: ProductDetail): void {
  // Evict oldest entry if at capacity
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(id, { data, timestamp: Date.now() })
}

export function invalidateCachedProduct(id: string): void {
  cache.delete(id)
}
