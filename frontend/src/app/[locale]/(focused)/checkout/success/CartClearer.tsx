'use client'

import { useCart } from '@/hooks/useCart'
import { useEffect, useRef } from 'react'
import { apiFetch } from '@/lib/api-fetch'

/**
 * Client component that clears the cart after a successful payment.
 * Renders nothing visible -- purely a side-effect component.
 * Uses the cart API directly to avoid showing a "Cart cleared" toast.
 */
export function CartClearer() {
  const { items, refreshCart } = useCart()
  const hasClearedRef = useRef(false)

  useEffect(() => {
    // Only clear if there are items and we haven't already cleared in this mount
    if (items.length > 0 && !hasClearedRef.current) {
      hasClearedRef.current = true
      apiFetch('/api/cart', { method: 'DELETE' })
        .then((res) => {
          if (res.ok) {
            refreshCart()
          }
        })
        .catch((err) => console.error('Failed to clear cart after payment:', err))
    }
  }, [items, refreshCart])

  return null
}
