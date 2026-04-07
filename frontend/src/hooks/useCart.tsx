'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from './useAuth'
import { apiFetch } from '@/lib/api-fetch'

interface CartItem {
  id: string
  product_id: string
  product_slug?: string
  variant_id?: string
  quantity: number
  product_title: string
  product_price: number
  product_image?: string
  product_currency?: string
  unavailable?: boolean
  variant_details?: {
    size?: string
    color?: string
  }
  personalization_id?: string
  personalization?: {
    text?: string
    font?: string
    fontColor?: string
    fontSize?: string
    position?: string
    preview?: string | null
    surcharge?: number | null
  }
}

interface AvailableVariants {
  [productId: string]: { sizes: string[]; colors: string[] }
}

interface CartContextType {
  items: CartItem[]
  itemCount: number
  loading: boolean
  availableVariants: AvailableVariants
  addToCart: (productId: string, quantity: number, variant?: { size?: string; color?: string }, productTitle?: string, productPrice?: number, personalizationId?: string, compositionId?: string) => Promise<void>
  removeFromCart: (itemId: string) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  updateVariant: (itemId: string, variant: { size?: string; color?: string }) => Promise<void>
  clearCart: () => Promise<void>
  refreshCart: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [availableVariants, setAvailableVariants] = useState<AvailableVariants>({})
  const { user } = useAuth()

  const refreshCart = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/cart')
      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
        setAvailableVariants(data.available_variants || {})
      }
    } catch (error) {
      console.error('Failed to fetch cart:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load cart on mount and when user changes
  useEffect(() => {
    refreshCart()
  }, [user, refreshCart])

  const addToCart = useCallback(async (
    productId: string,
    quantity: number,
    variant?: { size?: string; color?: string },
    productTitle?: string,
    productPrice?: number,
    personalizationId?: string,
    compositionId?: string
  ) => {
    try {
      const response = await apiFetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          quantity,
          variant_details: variant,
          product_title: productTitle,
          product_price: productPrice,
          ...(personalizationId ? { personalization_id: personalizationId } : {}),
          ...(compositionId ? { composition_id: compositionId } : {}),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const err = new Error(errorData.message || errorData.error || 'Failed to add to cart')
        ;(err as any).code = errorData.code
        throw err
      }

      await refreshCart()
      toast.success('Added to cart', {
        description: `${productTitle || 'Product'} has been added to your cart`,
      })
    } catch (error: any) {
      console.error('Add to cart error:', error)
      if (error?.code === 'VARIANT_REQUIRED') {
        toast.info('Please select a size or color', {
          description: error.message || 'This product requires selecting a variant.',
        })
      } else {
        toast.error('Failed to add to cart', {
          description: error instanceof Error ? error.message : 'Please try again',
        })
      }
      throw error
    }
  }, [refreshCart])

  const removeFromCart = useCallback(async (itemId: string) => {
    // Store previous state for rollback
    const previousItems = [...items]

    try {
      // Optimistic update: remove item immediately
      setItems(prevItems => prevItems.filter(item => item.id !== itemId))

      // Make API call in background
      const response = await apiFetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity: 0 }),
      })

      if (!response.ok) {
        throw new Error('Failed to remove from cart')
      }

      toast.success('Removed from cart')
    } catch (error) {
      // Rollback on error
      setItems(previousItems)
      console.error('Remove from cart error:', error)
      toast.error('Failed to remove from cart')
      throw error
    }
  }, [items])

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    // Store previous state for rollback
    const previousItems = [...items]

    try {
      // Optimistic update: update local state immediately
      setItems(prevItems => {
        if (quantity === 0) {
          // Remove item if quantity is 0
          return prevItems.filter(item => item.id !== itemId)
        }
        // Update quantity
        return prevItems.map(item =>
          item.id === itemId ? { ...item, quantity } : item
        )
      })

      // Make API call in background
      const response = await apiFetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity }),
      })

      if (!response.ok) {
        throw new Error('Failed to update quantity')
      }

      // No need to call refreshCart() - we already updated optimistically
    } catch (error) {
      // Rollback on error
      setItems(previousItems)
      console.error('Update quantity error:', error)
      toast.error('Failed to update quantity')
      throw error
    }
  }, [items])

  const updateVariant = useCallback(async (itemId: string, variant: { size?: string; color?: string }) => {
    try {
      const response = await apiFetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, variant_details: variant }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Failed to update variant')
      }

      await refreshCart()
    } catch (error) {
      console.error('Update variant error:', error)
      toast.error('Failed to update variant')
      throw error
    }
  }, [refreshCart])

  const clearCart = useCallback(async () => {
    try {
      const response = await apiFetch('/api/cart', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to clear cart')
      }

      await refreshCart()
      toast.success('Cart cleared')
    } catch (error) {
      console.error('Clear cart error:', error)
      toast.error('Failed to clear cart')
      throw error
    }
  }, [refreshCart])

  const itemCount = items.reduce((total, item) => total + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        loading,
        availableVariants,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateVariant,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
