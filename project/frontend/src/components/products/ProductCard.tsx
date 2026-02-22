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

interface Product {
  id: string
  title: string
  description: string
  price: number
  currency: string
  image: string
  rating?: number
  reviewCount?: number
  category?: string
  variants?: {
    sizes?: string[]
    colors?: string[]
    colorImages?: Record<string, string>
  }
  stock?: number
  inStock?: boolean
}

interface ProductCardProps {
  product: Product
  priority?: boolean
}

export function ProductCard({ product, priority }: ProductCardProps) {
  const t = useTranslations('product')
  const locale = useLocale()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const { addToCart } = useCart()
  const { setSelectedProduct, addArtifact } = useStorefront()
  const [imgError, setImgError] = useState(false)
  const wishlisted = isWishlisted(product.id)

  // Color variant selection (user-driven, no auto-rotation)
  const colorImages = product.variants?.colorImages
  const colorEntries = colorImages ? Object.entries(colorImages) : []
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

  const handleColorSwatchHover = useCallback((i: number) => {
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

  const productHref = `/shop/${product.id}${displayColor ? `?color=${encodeURIComponent(displayColor)}` : ''}`

  return (
    <>
      <Link
        href={productHref}
        className="group flex flex-col rounded-2xl bg-card overflow-hidden border border-border/40 hover:border-border/80 shadow-sm hover:shadow-xl transition-all duration-300"
      >
        {/* Image */}
        <div className="relative aspect-square bg-muted overflow-hidden">
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

          {/* Out of stock overlay */}
          {product.inStock === false && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Badge variant="secondary" className="text-xs">{t('outOfStock')}</Badge>
            </div>
          )}

          {/* Wishlist heart — always visible */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm hover:bg-card/90"
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
        <div className="flex flex-col flex-1 px-3.5 py-3 space-y-2">
          <h3 className="font-medium text-sm leading-snug line-clamp-1 text-foreground group-hover:text-primary transition-colors">
            {product.title}
          </h3>

          {/* Color variant swatches — mini product thumbnails */}
          {hasMultipleColors && (
            <div className="flex items-center gap-1.5">
              {colorEntries.map(([color, imgUrl], i) => (
                <button
                  key={color}
                  className={cn(
                    'relative w-6 h-6 rounded-full overflow-hidden border-2 transition-all duration-200 flex-shrink-0',
                    i === colorIdx
                      ? 'border-primary ring-1 ring-primary/30'
                      : 'border-border/60 hover:border-border'
                  )}
                  onClick={(e) => handleColorSwatch(e, i)}
                  onMouseEnter={() => handleColorSwatchHover(i)}
                  aria-label={color}
                  title={color}
                >
                  <Image
                    src={imgUrl}
                    alt={color}
                    fill
                    className="object-cover"
                    sizes="24px"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground tracking-tight">
              {formattedPrice}
            </p>
            {product.rating != null && product.rating > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star className="h-3 w-3 fill-rating text-rating" />
                <span>{product.rating.toFixed(1)}</span>
                {product.reviewCount ? <span>({product.reviewCount})</span> : null}
              </div>
            )}
          </div>

          {/* Action buttons — always visible, touch-friendly */}
          <div className="flex gap-1.5 pt-0.5 mt-auto">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs font-medium rounded-lg"
              onClick={handleAddToCart}
              disabled={product.inStock === false}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              {product.inStock === false ? t('outOfStock') : t('addToCart')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg flex-shrink-0"
              onClick={handleQuickView}
              title={t('quickView')}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Link>
    </>
  )
}
