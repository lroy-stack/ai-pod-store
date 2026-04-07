'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Star, Heart, ShoppingCart, ImageOff, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWishlist } from '@/hooks/useWishlist'
import { useCart } from '@/hooks/useCart'
import { useStorefront } from '@/components/storefront/StorefrontContext'
import { ProductBadge } from '@/components/products/ProductBadge'
import type { ProductCard as ProductCardType } from '@/types/product'

interface ProductCardProps {
  product: ProductCardType
  priority?: boolean
}

export function ProductCard({ product, priority }: ProductCardProps) {
  const t = useTranslations('product')
  const tShop = useTranslations('shop')
  const locale = useLocale()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const { addToCart } = useCart()
  const { setSelectedProduct, addArtifact } = useStorefront()
  const [imgError, setImgError] = useState(false)
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
  const displayColor = hasMultipleColors ? colorEntries[colorIdx][0] : null

  const handleColorSwatch = useCallback((e: React.MouseEvent, i: number) => {
    e.preventDefault()
    e.stopPropagation()
    setColorIdx(i)
    setImgError(false)
  }, [])

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleWishlist(product.id)
  }

  // Determine if product has multiple variant options requiring selection
  const sizesCount = product.variants?.sizes?.length || 0
  const colorsCount = product.variants?.colors?.length || 0
  const hasMultipleVariants = sizesCount > 1 || (sizesCount >= 1 && colorsCount > 1)

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (hasMultipleVariants) {
      // Open product detail for variant selection instead of blind add
      addArtifact({
        id: product.id,
        type: 'product',
        title: product.title,
        data: product,
      })
      setSelectedProduct(product.id)
    } else {
      // Single variant — server will autoselect
      addToCart(product.id, 1, undefined, product.title, product.price)
    }
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addArtifact({
      id: product.id,
      type: 'product',
      title: product.title,
      data: product,
    })
    setSelectedProduct(product.id)
  }

  const localizedPrice = getLocalizedPrice(product.price, product.currency, locale)
  const formattedPrice = formatPrice(localizedPrice, locale)
  const showFromPrice = product.hasVariantPricing === true

  const productHref = `/${locale}/shop/${product.slug}${displayColor ? `?color=${encodeURIComponent(displayColor)}` : ''}`

  return (
    <Link
      href={productHref}
      className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {displayImage && !imgError ? (
          <Image
            src={displayImage}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={priority}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
            <ImageOff className="h-10 w-10" />
            <span className="text-xs font-medium text-muted-foreground/60">{product.title}</span>
          </div>
        )}

        {/* Product labels (trending, bestseller, etc.) */}
        {product.labels && product.labels.length > 0 && (
          <ProductBadge labels={product.labels} />
        )}

        {/* Out of stock overlay */}
        {product.inStock === false && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Badge variant="secondary" className="text-xs">{t('outOfStock')}</Badge>
          </div>
        )}

        {/* Color variant swatches — overlay bottom-left of image */}
        {hasMultipleColors && (
          <div className="absolute bottom-1 left-1 right-10 flex items-center gap-1 z-10 overflow-x-auto scrollbar-hide py-1 px-0.5">
            {colorEntries.slice(0, 5).map(([color, imgUrl], i) => (
              <button
                key={color}
                className={cn(
                  'relative rounded-full overflow-hidden border-2 transition-all duration-200 flex-shrink-0 shadow-sm p-0',
                  'w-8 h-8 min-w-8 min-h-8',
                  i === colorIdx
                    ? 'border-primary ring-2 ring-primary/40'
                    : 'border-card/80 hover:border-primary/50'
                )}
                onClick={(e) => handleColorSwatch(e, i)}
                aria-label={color}
                title={color}
              >
                <span className="relative w-full h-full rounded-full overflow-hidden block">
                  <Image
                    src={imgUrl}
                    alt={color}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </span>
              </button>
            ))}
            {colorEntries.length > 5 && (
              <span className="text-[10px] text-muted-foreground flex-shrink-0 pl-0.5">
                +{colorEntries.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Wishlist heart — neumorphic raised circle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2.5 right-2.5 h-10 w-10 rounded-full neu-fav"
          onClick={handleToggleWishlist}
          aria-label={wishlisted ? t('removeFromWishlist') : t('addToWishlist')}
        >
          <Heart
            className={cn(
              'h-4 w-4',
              wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground'
            )}
          />
        </Button>
      </div>

      {/* Info + Actions */}
      <div className="flex flex-col flex-1 px-3 pt-2.5 pb-2 space-y-1">
        {/* Category + Rating row */}
        <div className="flex items-center justify-between">
          {product.category && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {tShop.has(`category.${product.category}`) ? tShop(`category.${product.category}`) : product.category}
            </span>
          )}
          {product.rating != null && product.rating > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
              <Star className="h-3 w-3 fill-rating text-rating" />
              <span>{product.rating.toFixed(1)}</span>
              {product.reviewCount ? <span>({product.reviewCount})</span> : null}
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="font-medium text-sm leading-snug line-clamp-1 text-foreground group-hover:text-primary transition-colors">
          {product.title}
        </h3>

        {/* Description */}
        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Price + Actions */}
        <div className="flex items-end justify-between gap-2 mt-auto">
          {product.compareAtPrice ? (
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] md:text-xs line-through text-muted-foreground">
                  {formatPrice(getLocalizedPrice(product.compareAtPrice, product.currency, locale), locale)}
                </span>
                {(() => {
                  const pct = Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
                  return pct > 0 ? (
                    <Badge variant="destructive" className="text-[9px] md:text-[10px] leading-none px-1 py-0.5">
                      -{pct}%
                    </Badge>
                  ) : null
                })()}
              </div>
              <p className="text-sm font-bold text-destructive tracking-tight">
                {formattedPrice}
              </p>
            </div>
          ) : (
            <p className="text-sm font-semibold text-foreground tracking-tight">
              {showFromPrice && (
                <span className="text-xs font-normal text-muted-foreground mr-0.5">
                  {t('fromPrice')}{' '}
                </span>
              )}
              {formattedPrice}
            </p>
          )}
          <div className="flex gap-1 md:gap-1.5 shrink-0">
            <Button
              size="icon"
              className="h-9 w-9 md:h-10 md:w-10 neu-btn-accent"
              onClick={handleAddToCart}
              disabled={product.inStock === false}
              title={product.inStock === false ? t('outOfStock') : t('addToCart')}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 md:h-10 md:w-10 neu-btn-soft"
              onClick={handleQuickView}
              title={t('quickView')}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Link>
  )
}
