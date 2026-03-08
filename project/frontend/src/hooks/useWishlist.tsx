'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from './useAuth'
import { apiFetch } from '@/lib/api-fetch'

const GUEST_WISHLIST_KEY = 'pod-guest-wishlist'
const GUEST_MAX_ITEMS = 50

interface WishlistItem {
  id: string        // wishlist_item id (needed for DELETE)
  product_id: string
}

interface GuestWishlistItem {
  product_id: string
  added_at: string
}

interface WishlistContextType {
  wishlistItems: string[]       // product_ids in user's default wishlist
  loading: boolean
  isWishlisted: (productId: string) => boolean
  toggleWishlist: (productId: string) => Promise<void>
  refreshWishlist: () => Promise<void>
  guestItemCount: number
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

/**
 * Read guest wishlist from localStorage.
 */
function readGuestWishlist(): GuestWishlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY)
    if (!raw) return []
    const items = JSON.parse(raw)
    return Array.isArray(items) ? items.slice(0, GUEST_MAX_ITEMS) : []
  } catch {
    return []
  }
}

/**
 * Write guest wishlist to localStorage.
 */
function writeGuestWishlist(items: GuestWishlistItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items.slice(0, GUEST_MAX_ITEMS)))
  } catch {
    // localStorage full or disabled
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [serverItems, setServerItems] = useState<WishlistItem[]>([])
  const [localItems, setLocalItems] = useState<GuestWishlistItem[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  // Initialize guest wishlist from localStorage on mount
  useEffect(() => {
    setLocalItems(readGuestWishlist())
  }, [])

  // Fetch server wishlist when user is authenticated
  const refreshWishlist = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/wishlist')
      if (response.ok) {
        const data = await response.json()
        const wishlists = data.wishlists || []
        if (wishlists.length > 0 && wishlists[0].wishlist_items) {
          setServerItems(
            wishlists[0].wishlist_items.map((item: any) => ({
              id: item.id,
              product_id: item.product_id,
            }))
          )
        } else {
          setServerItems([])
        }
      }
    } catch (error) {
      console.error('Failed to fetch wishlist:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load server wishlist on mount and when user changes
  useEffect(() => {
    if (user) {
      refreshWishlist()
    } else {
      setServerItems([])
    }
  }, [user, refreshWishlist])

  // Sync guest wishlist to server on login
  useEffect(() => {
    if (user && localItems.length > 0) {
      syncGuestWishlistToServer(localItems).then((success) => {
        if (success) {
          localStorage.removeItem(GUEST_WISHLIST_KEY)
          setLocalItems([])
        }
        refreshWishlist()
      })
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute unified items list
  const items = user
    ? serverItems
    : localItems.map((i) => ({ id: i.product_id, product_id: i.product_id }))

  const wishlistItems = items.map((i) => i.product_id)

  const isWishlisted = useCallback(
    (productId: string) => {
      if (user) {
        return serverItems.some((item) => item.product_id === productId)
      }
      return localItems.some((item) => item.product_id === productId)
    },
    [user, serverItems, localItems]
  )

  const toggleWishlist = useCallback(
    async (productId: string) => {
      // === GUEST MODE: localStorage toggle ===
      if (!user) {
        const existing = localItems.find((item) => item.product_id === productId)
        if (existing) {
          const updated = localItems.filter((i) => i.product_id !== productId)
          setLocalItems(updated)
          writeGuestWishlist(updated)
          toast.success('Removed from wishlist')
        } else {
          if (localItems.length >= GUEST_MAX_ITEMS) {
            toast.error('Wishlist is full. Sign in to save more items.')
            return
          }
          const updated = [...localItems, { product_id: productId, added_at: new Date().toISOString() }]
          setLocalItems(updated)
          writeGuestWishlist(updated)
          toast.success('Added to wishlist')
        }
        return
      }

      // === AUTHENTICATED MODE: Server toggle ===
      const existing = serverItems.find((item) => item.product_id === productId)

      if (existing) {
        // Optimistic remove
        const prev = [...serverItems]
        setServerItems((curr) => curr.filter((i) => i.product_id !== productId))

        try {
          const response = await apiFetch(`/api/wishlist/items?item_id=${existing.id}`, {
            method: 'DELETE',
          })
          if (!response.ok) throw new Error('Failed to remove from wishlist')
          toast.success('Removed from wishlist')
        } catch (error) {
          setServerItems(prev)
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
            const createRes = await apiFetch('/api/wishlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'My Wishlist' }),
            })
            if (!createRes.ok) {
              toast.error('Failed to create wishlist')
              return
            }
            const createData = await createRes.json()
            wishlistId = createData.wishlist?.id
            if (!wishlistId) {
              toast.error('Failed to create wishlist')
              return
            }
          }

          const response = await apiFetch('/api/wishlist/items', {
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
            setServerItems((curr) => [
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
    [user, serverItems, localItems, refreshWishlist]
  )

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        loading,
        isWishlisted,
        toggleWishlist,
        refreshWishlist,
        guestItemCount: localItems.length,
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

/**
 * Sync guest wishlist items to server.
 * Returns true if the sync was successful, false otherwise.
 */
async function syncGuestWishlistToServer(items: GuestWishlistItem[]): Promise<boolean> {
  try {
    const res = await apiFetch('/api/wishlist/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    return res.ok
  } catch (error) {
    console.error('Failed to sync guest wishlist:', error)
    return false
  }
}
