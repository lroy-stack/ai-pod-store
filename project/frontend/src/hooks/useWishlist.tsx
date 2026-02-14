'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from './useAuth'

interface WishlistItem {
  id: string        // wishlist_item id (needed for DELETE)
  product_id: string
}

interface WishlistContextType {
  wishlistItems: string[]       // product_ids in user's default wishlist
  loading: boolean
  isWishlisted: (productId: string) => boolean
  toggleWishlist: (productId: string) => Promise<void>
  refreshWishlist: () => Promise<void>
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const refreshWishlist = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/wishlist')
      if (response.ok) {
        const data = await response.json()
        const wishlists = data.wishlists || []
        if (wishlists.length > 0 && wishlists[0].wishlist_items) {
          setItems(
            wishlists[0].wishlist_items.map((item: any) => ({
              id: item.id,
              product_id: item.product_id,
            }))
          )
        } else {
          setItems([])
        }
      }
    } catch (error) {
      console.error('Failed to fetch wishlist:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load wishlist on mount and when user changes
  useEffect(() => {
    if (user) {
      refreshWishlist()
    } else {
      setItems([])
    }
  }, [user, refreshWishlist])

  const isWishlisted = useCallback(
    (productId: string) => items.some((item) => item.product_id === productId),
    [items]
  )

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const existing = items.find((item) => item.product_id === productId)

      if (existing) {
        // Optimistic remove
        const prev = [...items]
        setItems((curr) => curr.filter((i) => i.product_id !== productId))

        try {
          const response = await fetch(`/api/wishlist/items?item_id=${existing.id}`, {
            method: 'DELETE',
          })
          if (!response.ok) throw new Error('Failed to remove from wishlist')
          toast.success('Removed from wishlist')
        } catch (error) {
          setItems(prev)
          console.error('Remove from wishlist error:', error)
          toast.error('Failed to remove from wishlist')
        }
      } else {
        // Add to wishlist — get-or-create default wishlist
        try {
          const wishlistsRes = await fetch('/api/wishlist')
          const wishlistsData = await wishlistsRes.json()

          let wishlistId: string

          if (wishlistsData.wishlists && wishlistsData.wishlists.length > 0) {
            wishlistId = wishlistsData.wishlists[0].id
          } else {
            const createRes = await fetch('/api/wishlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'My Wishlist' }),
            })
            const createData = await createRes.json()
            wishlistId = createData.wishlist.id
          }

          const response = await fetch('/api/wishlist/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wishlist_id: wishlistId,
              product_id: productId,
              variant_id: null,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            setItems((curr) => [
              ...curr,
              { id: data.item?.id || data.id || '', product_id: productId },
            ])
            toast.success('Added to wishlist')
          } else if (response.status === 409) {
            // Already in wishlist — refresh to sync
            await refreshWishlist()
          } else {
            throw new Error('Failed to add to wishlist')
          }
        } catch (error) {
          console.error('Add to wishlist error:', error)
          toast.error('Failed to add to wishlist')
        }
      }
    },
    [items, refreshWishlist]
  )

  const wishlistItems = items.map((i) => i.product_id)

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        loading,
        isWishlisted,
        toggleWishlist,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider')
  }
  return context
}
