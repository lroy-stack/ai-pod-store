'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'pod_recently_viewed'
const MAX_ITEMS = 8

export interface RecentlyViewedProduct {
  id: string
  slug: string
  title: string
  price: number
  currency: string
  image: string | null
  compareAtPrice?: number
  colorImages?: Record<string, string>
  viewedAt: number
}

export function useRecentlyViewed() {
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([])

  // Load recently viewed products from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as RecentlyViewedProduct[]
        // Drop stale entries without slug (pre-migration data)
        const valid = parsed.filter((p) => !!p.slug)
        setRecentlyViewed(valid)
        if (valid.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Track a viewed product
  const trackView = (product: Omit<RecentlyViewedProduct, 'viewedAt'>) => {
    const newProduct: RecentlyViewedProduct = {
      ...product,
      viewedAt: Date.now(),
    }

    setRecentlyViewed((prev) => {
      // Remove existing entry for this product
      const filtered = prev.filter((p) => p.id !== product.id)

      // Add new entry at the beginning
      const updated = [newProduct, ...filtered].slice(0, MAX_ITEMS)

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

      return updated
    })
  }

  // Get recently viewed products excluding a specific product ID
  const getRecentlyViewed = (excludeId?: string) => {
    if (excludeId) {
      return recentlyViewed.filter((p) => p.id !== excludeId)
    }
    return recentlyViewed
  }

  return {
    recentlyViewed,
    trackView,
    getRecentlyViewed,
  }
}
