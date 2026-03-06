'use client'

/**
 * ProductGridArtifact - Display product search results as a grid
 *
 * Tools that use this artifact:
 * - product_search
 * - browse_catalog
 * - get_recommendations
 *
 * Features:
 * - InlineCompact: 3-column grid within chat message, max 6 items
 * - Action buttons: "Add to Cart", "View Details" (→ opens detail panel)
 * - Touch-friendly: action buttons always visible
 */

import { useState } from 'react'
import { Star, ShoppingCart, ImageOff, Heart, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslations, useLocale } from 'next-intl'
import { formatPrice } from '@/lib/currency'
import { useCart } from '@/hooks/useCart'
import { useWishlist } from '@/hooks/useWishlist'
import { cn } from '@/lib/utils'
import type { ProductCard } from '@/types/product'

interface ProductGridArtifactProps {
  products: ProductCard[]
  onSelectProduct: (productId: string, productData?: ProductCard) => void
  variant?: 'inline' | 'full'
}

export function ProductGridArtifact({
  products,
  onSelectProduct,
  variant = 'inline',
}: ProductGridArtifactProps) {
  const t = useTranslations('storefront')
  const locale = useLocale()
  const { addToCart } = useCart()

  // Limit to 6 items for inline compact variant
  const displayProducts = variant === 'inline' ? products.slice(0, 6) : products

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{t('noProductsFound')}</p>
      </div>
    )
  }

  return (
    <div className="neu-grid">
      {displayProducts.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          locale={locale}
          t={t}
          onSelect={() => onSelectProduct(product.id, product)}
          onAddToCart={() => addToCart(product.id, 1, undefined, product.title, product.price)}
        />
      ))}
    </div>
  )
}

function ProductCard({
  product,
  locale,
  t,
  onSelect,
  onAddToCart,
}: {
  product: ProductCard
  locale: string
  t: ReturnType<typeof useTranslations>
  onSelect: () => void
  onAddToCart: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const { isWishlisted, toggleWishlist } = useWishlist()
  const wishlisted = isWishlisted(product.id)

  return (
    <div
      className="group relative neu-card bg-card overflow-hidden cursor-pointer"
      onClick={onSelect}
    >
      {/* Image — square */}
      <div className="aspect-square relative neu-image overflow-hidden">
        {product.image && !imgError ? (
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
            <ImageOff className="h-10 w-10" />
            <span className="text-xs font-medium text-muted-foreground/60">{t('noImage')}</span>
          </div>
        )}

        {/* Wishlist heart — always visible */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full neu-fav"
          onClick={(e) => {
            e.stopPropagation()
            toggleWishlist(product.id)
          }}
        >
          <Heart className={cn('h-4 w-4', wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
        </Button>
      </div>

      {/* Info + Actions */}
      <div className="flex flex-col flex-1 px-3 pt-2.5 pb-2 space-y-1">
        {(product.rating ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
            <Star className="h-3 w-3 fill-rating text-rating" />
            <span>{(product.rating ?? 0).toFixed(1)}</span>
          </div>
        )}
        <h3 className="font-medium text-sm leading-snug line-clamp-1 text-foreground">
          {product.title}
        </h3>

        {/* Price left + icon CTAs right */}
        <div className="flex items-center justify-between mt-auto">
          {product.compareAtPrice ? (
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] line-through text-muted-foreground">
                  {formatPrice(product.compareAtPrice, locale, product.currency)}
                </span>
                {(() => {
                  const pct = Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
                  return pct > 0 ? (
                    <Badge variant="destructive" className="text-[10px] leading-none px-1 py-0.5">-{pct}%</Badge>
                  ) : null
                })()}
              </div>
              <p className="text-sm font-bold text-destructive tracking-tight">
                {formatPrice(product.price, locale, product.currency)}
              </p>
            </div>
          ) : (
            <p className="text-sm font-semibold text-foreground tracking-tight">
              {formatPrice(product.price, locale, product.currency)}
            </p>
          )}
          <div className="flex gap-1.5">
            <Button
              size="icon"
              className="h-8 w-8 neu-btn-accent"
              onClick={(e) => {
                e.stopPropagation()
                onAddToCart()
              }}
              title={t('addToCart')}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 neu-btn-soft"
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
              }}
              title={t('viewDetails')}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
