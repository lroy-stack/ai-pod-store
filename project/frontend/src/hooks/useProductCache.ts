import { useEffect, useState } from 'react'
import { cacheProducts, getCachedProducts } from '@/lib/idb-cache'

interface Product {
  id: string
  title: string
  description: string
  price: number
  currency: string
  image: string
  rating: number
  reviewCount: number
  category: string
  inStock: boolean
  createdAt: string
}

export function useProductCache(locale: string) {
  const [cachedProducts, setCachedProducts] = useState<Product[]>([])
  const [isLoadingCache, setIsLoadingCache] = useState(true)

  useEffect(() => {
    async function loadAndCacheProducts() {
      try {
        // First, try to load from IndexedDB cache
        const cached = await getCachedProducts()
        if (cached.length > 0) {
          setCachedProducts(cached as unknown as Product[])
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
