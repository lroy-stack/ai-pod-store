'use client'

import { useState, useEffect, useRef } from 'react'
import { getCachedProduct, setCachedProduct } from '@/lib/product-client-cache'
import type { ProductDetail } from '@/types/product'

interface UseProductDetailResult {
  product: ProductDetail | null
  loading: boolean
  error: string | null
}

/**
 * Fetches a single product by ID with client-side caching.
 * Pass `null` or `undefined` to skip the fetch.
 *
 * Deduplicates: won't re-fetch if the same productId is already loaded.
 * Cache: checks `product-client-cache` (in-memory, 5 min TTL) before network.
 */
export function useProductDetail(
  productId: string | null | undefined,
  locale: string
): UseProductDetailResult {
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!productId) {
      setProduct(null)
      setLoading(false)
      setError(null)
      fetchedIdRef.current = null
      return
    }

    // Already fetched this exact product
    if (fetchedIdRef.current === productId) return

    // Check client-side cache first
    const cached = getCachedProduct(productId)
    if (cached) {
      setProduct(cached)
      fetchedIdRef.current = productId
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/products/${productId}?locale=${locale}`)
      .then((res) => {
        if (!res.ok) throw new Error('Product not found')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const p = data.product || data
        setCachedProduct(productId, p)
        setProduct(p)
        fetchedIdRef.current = productId
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Failed to fetch product')
        console.error('Error fetching product:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [productId, locale])

  return { product, loading, error }
}
