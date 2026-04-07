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

import { useState, useCallback } from 'react'
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
    <div className="neu-grid neu-grid-chat">
      {displayProducts.map((product) => (
        <ProductCardItem
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

function ProductCardItem({
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

  // Color variant selection — light colors first (White, etc.)
  const colorImages = product.variants?.colorImages
  const colorEntries = colorImages
    ? Object.entries(colorImages).sort(([a], [b]) => {
        const aLight = /^white/i.test(a) ? 0 : 1
        const bLight = /^white/i.test(b) ? 0 : 1
        return aLight - bLight
      })
    : []
  const hasMultipleColors = colorEntries.length > 1
  const [colorIdx, setColorIdx] = useState(0)

  const displayImage = hasMultipleColors ? colorEntries[colorIdx][1] : product.image

  const handleColorSwatch = useCallback((e: React.MouseEvent, i: number) => {
    e.stopPropagation()
    setColorIdx(i)
    setImgError(false)
  }, [])

  return (
    <div
      className="group relative neu-card bg-card overflow-hidden cursor-pointer"
      onClick={onSelect}
    >
      {/* Image — square */}
      <div className="aspect-square relative neu-image overflow-hidden">
        {displayImage && !imgError ? (
          <img
            src={displayImage}
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

        {/* Color variant swatches — overlay bottom of image */}
        {hasMultipleColors && (
          <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 z-10 overflow-x-auto scrollbar-hide py-1 px-1">
            {colorEntries.map(([color, imgUrl], i) => (
              <button
                key={color}
                className={cn(
                  'relative rounded-full overflow-hidden border-2 transition-all duration-200 flex-shrink-0 shadow-sm p-0',
                  'w-[32px] h-[32px] min-w-[32px] min-h-[32px]',
                  i === colorIdx
                    ? 'border-primary ring-2 ring-primary/40'
                    : 'border-card/80 hover:border-primary/50'
                )}
                onClick={(e) => handleColorSwatch(e, i)}
                onMouseEnter={() => { setColorIdx(i); setImgError(false) }}
                aria-label={color}
                title={color}
              >
                <span className="relative w-full h-full rounded-full overflow-hidden block">
                  <img
                    src={imgUrl}
                    alt={color}
                    className="w-full h-full object-cover"
                  />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Wishlist heart */}
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
        {/* Category + Rating row */}
        <div className="flex items-center justify-between">
          {product.category && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {product.category}
            </span>
          )}
          {(product.rating ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
              <Star className="h-3 w-3 fill-rating text-rating" />
              <span>{(product.rating ?? 0).toFixed(1)}</span>
            </div>
          )}
        </div>

        <h3 className="font-medium text-sm leading-snug line-clamp-1 text-foreground">
          {product.title}
        </h3>

        {/* Price + Actions */}
        <div className="flex items-end justify-between gap-2 mt-auto">
          {product.compareAtPrice ? (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs line-through text-muted-foreground">
                  {formatPrice(product.compareAtPrice, locale, product.currency)}
                </span>
                {(() => {
                  const pct = Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
                  return pct > 0 ? (
                    <Badge variant="destructive" className="text-[10px] leading-none px-1.5 py-0.5">
                      -{pct}%
                    </Badge>
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
          <div className="flex gap-1.5 shrink-0">
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
