'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Heart, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProductCard } from '@/components/products/ProductCard'
import type { Wishlist } from '@/components/wishlist/types'

export default function SharedWishlistPage() {
  const t = useTranslations('wishlist')
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const token = params.token as string

  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/wishlist/shared/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'not_found' : 'error')
        return res.json()
      })
      .then((data) => setWishlist(data.wishlist))
      .catch((err) => setError(err.message === 'not_found' ? 'not_found' : 'error'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !wishlist) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <Heart className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">{t('sharedNotFound')}</p>
        <p className="text-xs text-muted-foreground mb-4">{t('sharedNotFoundDescription')}</p>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/${locale}/shop`}>{t('browseProducts')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="px-3 py-6 sm:px-4 md:px-6">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-lg font-semibold text-foreground">{wishlist.name}</h1>
        <Badge variant="outline" className="text-[10px]">{t('sharedList')}</Badge>
        <span className="text-xs text-muted-foreground">
          {wishlist.wishlist_items.length} {wishlist.wishlist_items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {wishlist.wishlist_items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Heart className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{t('noItems')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {wishlist.wishlist_items.map((item) => (
            <ProductCard key={item.id} product={item.products} />
          ))}
        </div>
      )}
    </div>
  )
}
