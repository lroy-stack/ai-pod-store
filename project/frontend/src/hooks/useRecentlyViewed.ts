'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'pod_recently_viewed'
const MAX_ITEMS = 8

export interface RecentlyViewedProduct {
  id: string
  title: string
  price: number
  currency: string
  image: string | null
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
        setRecentlyViewed(parsed)
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
