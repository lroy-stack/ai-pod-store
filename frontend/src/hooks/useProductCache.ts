import { useEffect, useState } from 'react'
import { cacheProducts, getCachedProducts } from '@/lib/idb-cache'
import type { ProductCard } from '@/types/product'

export function useProductCache(locale: string) {
  const [cachedProducts, setCachedProducts] = useState<ProductCard[]>([])
  const [isLoadingCache, setIsLoadingCache] = useState(true)

  useEffect(() => {
    async function loadAndCacheProducts() {
      try {
        // First, try to load from IndexedDB cache
        const cached = await getCachedProducts()
        if (cached.length > 0) {
          setCachedProducts(cached as unknown as ProductCard[])
        }

        // Then fetch fresh data from API
        const res = await fetch(`/api/products?limit=100&locale=${locale}`)
        const data = await res.json()

        if (data.success && data.items) {
          setCachedProducts(data.items)
          // Update IndexedDB cache with fresh data
          await cacheProducts(data.items)
        }
      } catch (error) {
        console.error('Error loading products:', error)
      } finally {
        setIsLoadingCache(false)
      }
    }

    loadAndCacheProducts()
  }, [locale])

  return { cachedProducts, isLoadingCache }
}
