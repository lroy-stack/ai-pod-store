'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useWishlist } from '@/hooks/useWishlist'
import { apiFetch } from '@/lib/api-fetch'
import { ProductGrid } from '@/components/products/ProductGrid'
import { WishlistSection } from '@/components/wishlist/WishlistSection'
import { WishlistEmptyState } from '@/components/wishlist/WishlistEmptyState'
import { CreateWishlistDialog, RenameWishlistDialog, ShareWishlistDialog } from '@/components/wishlist/WishlistDialogs'
import { GuestWishlistBanner } from '@/components/wishlist/GuestWishlistBanner'
import type { Wishlist, WishlistItem } from '@/components/wishlist/types'
import type { ProductCard as ProductCardType } from '@/types/product'

export default function WishlistPage() {
  const t = useTranslations('wishlist')
  const { user } = useAuth()
  const { wishlistItems, loading: wishlistLoading } = useWishlist()

  const [wishlists, setWishlists] = useState<Wishlist[]>([])
  const [guestProducts, setGuestProducts] = useState<ProductCardType[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  // --- Data fetching ---

  const fetchWishlists = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/wishlist')
      const data = await res.json()
      setWishlists(data.wishlists || [])
    } catch {
      /* non-critical */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchWishlists()
  }, [user, fetchWishlists])

  useEffect(() => {
    if (!user && !wishlistLoading) {
      if (wishlistItems.length > 0) {
        fetchGuestProducts(wishlistItems)
      } else {
        setGuestProducts([])
        setLoading(false)
      }
    }
  }, [user, wishlistItems, wishlistLoading])

  const fetchGuestProducts = async (ids: string[]) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/products?ids=${ids.join(',')}`)
      const data = await res.json()
      if (data.success && data.items) setGuestProducts(data.items)
    } catch {
      /* non-critical */
    } finally {
      setLoading(false)
    }
  }

  // --- CRUD handlers ---

  const handleCreate = async (name: string) => {
    const res = await apiFetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) fetchWishlists()
  }

  const handleDelete = async (id: string) => {
    const res = await apiFetch(`/api/wishlist?wishlist_id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(t('wishlistDeleted'))
      fetchWishlists()
    } else {
      toast.error(t('deleteError'))
    }
  }

  const handleRenameOpen = (id: string) => {
    const wl = wishlists.find((w) => w.id === id)
    if (wl) {
      setRenameTarget({ id, name: wl.name })
      setRenameOpen(true)
    }
  }

  const handleRename = async (name: string) => {
    if (!renameTarget) return
    const res = await apiFetch('/api/wishlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wishlist_id: renameTarget.id, name }),
    })
    if (res.ok) {
      toast.success(t('renamed'))
      fetchWishlists()
    } else {
      toast.error(t('renameError'))
    }
  }

  const handleShare = async (id: string) => {
    const res = await apiFetch('/api/wishlist/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wishlist_id: id }),
    })
    if (res.ok) {
      const data = await res.json()
      setShareUrl(data.share_url)
      setShareOpen(true)
      fetchWishlists()
    }
  }

  const handleAddAllToCart = async (items: WishlistItem[]) => {
    let added = 0
    let variantRequired = 0
    for (const item of items) {
      const res = await apiFetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: item.products.id, variant_id: item.variant_id, quantity: 1 }),
      })
      if (res.ok) {
        added++
      } else {
        const data = await res.json().catch(() => null)
        if (data?.code === 'VARIANT_REQUIRED') variantRequired++
      }
    }
    if (added > 0) toast.success(t('addedToCartCount', { count: added }))
    if (variantRequired > 0) toast.warning(t('variantRequiredCount', { count: variantRequired }))
  }

  // --- Loading ---
  if (loading || wishlistLoading) {
    return (
      <div className="px-3 py-6 sm:px-4 md:px-6">
        <ProductGrid products={[]} isLoading skeletonCount={6} />
      </div>
    )
  }

  // --- Guest mode ---
  if (!user) {
    return (
      <div className="px-3 py-6 sm:px-4 md:px-6">
        <h1 className="text-lg font-semibold text-foreground mb-4">{t('myWishlist')}</h1>
        {guestProducts.length === 0 ? (
          <WishlistEmptyState />
        ) : (
          <>
            <GuestWishlistBanner />
            <ProductGrid products={guestProducts} />
          </>
        )}
      </div>
    )
  }

  // --- Auth mode ---
  return (
    <div className="px-3 py-6 sm:px-4 md:px-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Heart className="h-3.5 w-3.5 mr-1.5" />
          {t('createNew')}
        </Button>
      </div>

      {wishlists.length === 0 ? (
        <WishlistEmptyState onAction={() => setCreateOpen(true)} />
      ) : (
        <div className="space-y-8">
          {wishlists.map((wl) => (
            <WishlistSection
              key={wl.id}
              id={wl.id}
              name={wl.name}
              isPublic={wl.is_public}
              items={wl.wishlist_items}
              onRename={handleRenameOpen}
              onDelete={handleDelete}
              onShare={handleShare}
              onAddAllToCart={handleAddAllToCart}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateWishlistDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
      <RenameWishlistDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={renameTarget?.name || ''}
        onRename={handleRename}
      />
      <ShareWishlistDialog open={shareOpen} onOpenChange={setShareOpen} shareUrl={shareUrl} />
    </div>
  )
}
