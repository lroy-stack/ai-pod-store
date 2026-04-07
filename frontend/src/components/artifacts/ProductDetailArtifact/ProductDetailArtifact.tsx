'use client'

/**
 * ProductDetailArtifact - Interactive product detail card for chat
 *
 * Tools that use this artifact:
 * - get_product_detail
 *
 * Features:
 * - Image gallery with thumbnails (reuses ProductImageGallery)
 * - Interactive variant selectors for size/color
 * - Discount badge with percentage
 * - Shipping info badge
 * - Add to Cart with selected variants
 * - Wishlist toggle
 * - Collapsible specs (materials, care, GPSR)
 */

import { useState, useMemo, useEffect } from 'react'
import { Star, ShoppingCart, Heart, Shirt, Globe, Printer, Droplets, ShieldCheck, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTranslations, useLocale } from 'next-intl'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useWishlist } from '@/hooks/useWishlist'
import Image from 'next/image'
import { VariantSelector } from '@/components/products/VariantSelector'
import { SafeHTML } from '@/components/common/SafeHTML'

export interface ProductDetail {
  id: string
  slug?: string
  title: string
  description: string
  category: string
  price: number
  compareAtPrice?: number
  currency: string
  images: { src: string; alt: string }[] | string[]
  rating: number
  reviewCount: number
  variants?: { sizes?: string[]; colors?: string[]; colorImages?: Record<string, string> }
  materials?: string
  careInstructions?: string
  printTechnique?: string
  manufacturingCountry?: string
  brand?: string
  safetyInformation?: string
  shippingInfo?: string
  available: boolean
}

interface ProductDetailArtifactProps {
  product: ProductDetail
  onAddToCart?: (productId: string, title?: string, price?: number, variants?: { size?: string; color?: string }) => void
  onAddToWishlist?: (productId: string) => void
  variant?: 'inline' | 'full'
}

export function ProductDetailArtifact({
  product,
  onAddToCart,
  variant: _variant = 'inline',
}: ProductDetailArtifactProps) {
  const t = useTranslations('storefront')
  const locale = useLocale()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const wishlisted = isWishlisted(product.id)

  const sizes = product.variants?.sizes || []
  const colors = product.variants?.colors || []

  const [selectedSize, setSelectedSize] = useState(sizes.length === 1 ? sizes[0] : '')
  const [selectedColor, setSelectedColor] = useState(colors.length > 0 ? colors[0] : '')
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)

  // Normalize images to string[]
  const allImageUrls = useMemo(() => {
    if (!product.images || product.images.length === 0) return []
    return product.images.map((img: any) =>
      typeof img === 'string' ? img : (img.src || img.url || '')
    ).filter(Boolean)
  }, [product.images])

  // Filter images by selected color (match color slug bounded by / or -)
  const imageUrls = useMemo(() => {
    if (!selectedColor || allImageUrls.length <= 1) return allImageUrls
    const colorSlug = selectedColor.toLowerCase().replace(/\s+/g, '-')
    // Match "/color-slug-" or "/color-slug." to handle both naming conventions
    const pattern = new RegExp(`/${colorSlug}[-.]`)
    const filtered = allImageUrls.filter(url => pattern.test(url.toLowerCase()))
    return filtered.length > 0 ? filtered : allImageUrls.slice(0, 1)
  }, [allImageUrls, selectedColor])

  // Reset image index when color changes
  useEffect(() => { setSelectedImageIdx(0) }, [selectedColor])

  // Determine if variant selection is needed for cart
  const needsSize = sizes.length > 1
  const needsColor = colors.length > 1
  const canAddToCart = product.available &&
    (!needsSize || selectedSize) &&
    (!needsColor || selectedColor)

  const handleAddToCart = () => {
    const variants: { size?: string; color?: string } = {}
    if (selectedSize) variants.size = selectedSize
    if (selectedColor) variants.color = selectedColor
    onAddToCart?.(product.id, product.title, product.price, Object.keys(variants).length > 0 ? variants : undefined)
  }

  const discountPct = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0

  return (
    <Card className="overflow-hidden max-w-lg w-full py-0 gap-0">
      {/* Image */}
      {imageUrls.length > 0 && (
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <Image
            src={imageUrls[selectedImageIdx] || imageUrls[0]}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        </div>
      )}

      {/* Thumbnails */}
      {imageUrls.length > 1 && (
        <div className="flex gap-1.5 px-4 pt-2 overflow-x-auto">
          {imageUrls.map((img, idx) => (
            <button
              key={img}
              onClick={() => setSelectedImageIdx(idx)}
              className={cn(
                'relative w-12 h-12 rounded-md overflow-hidden border-2 shrink-0 transition-all',
                selectedImageIdx === idx
                  ? 'border-primary'
                  : 'border-border/40 hover:border-border'
              )}
            >
              <Image src={img} alt={`${product.title} ${idx + 1}`} fill className="object-cover" sizes="48px" />
            </button>
          ))}
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        {/* Title + Price */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold leading-snug text-foreground">{product.title}</h3>
            {product.rating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      'size-3',
                      s <= Math.round(product.rating)
                        ? 'fill-rating text-rating'
                        : 'text-muted-foreground/25'
                    )}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-0.5">({product.reviewCount})</span>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            {product.compareAtPrice && discountPct > 0 ? (
              <div>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-xs line-through text-muted-foreground">
                    {formatPrice(product.compareAtPrice, locale, product.currency)}
                  </span>
                  <Badge variant="destructive" className="text-[10px] px-1 py-0">-{discountPct}%</Badge>
                </div>
                <p className="text-xl font-bold text-destructive">
                  {formatPrice(product.price, locale, product.currency)}
                </p>
              </div>
            ) : (
              <p className="text-xl font-bold text-foreground">
                {formatPrice(product.price, locale, product.currency)}
              </p>
            )}
          </div>
        </div>

        {/* Availability + Shipping badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/30">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {t('inStock')}
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Truck className="h-3 w-3" />
            {t('freeShippingFrom')}
          </Badge>
        </div>

        {/* Variant Selectors */}
        {(sizes.length > 0 || colors.length > 0) && (
          <>
            <Separator />
            <VariantSelector
              allSizes={sizes}
              allColors={colors}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
              onSizeChange={(s) => setSelectedSize(s === selectedSize ? '' : s)}
              onColorChange={(c) => setSelectedColor(c === selectedColor ? '' : c)}
              sizeLabel={sizes.length > 0 ? `${t('size')} ${selectedSize ? `— ${selectedSize}` : ''}` : undefined}
              colorLabel={colors.length > 0 ? `${t('color')} ${selectedColor ? `— ${selectedColor}` : ''}` : undefined}
            />
          </>
        )}

        {/* Description */}
        {product.description && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {product.description}
            </p>
          </>
        )}

        {/* Specs (collapsible) */}
        {(product.materials || product.printTechnique || product.manufacturingCountry) && (
          <details className="group">
            <summary className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t('specifications')}
              <span className="ml-auto text-[10px] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {product.materials && (
                <div className="flex items-start gap-1.5">
                  <Shirt className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{product.materials}</span>
                </div>
              )}
              {product.printTechnique && (
                <div className="flex items-start gap-1.5">
                  <Printer className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{product.printTechnique}</span>
                </div>
              )}
              {product.manufacturingCountry && (
                <div className="flex items-start gap-1.5">
                  <Globe className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{t('madeIn')}: {product.manufacturingCountry}</span>
                </div>
              )}
              {product.careInstructions && (
                <div className="flex items-start gap-1.5">
                  <Droplets className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{product.careInstructions}</span>
                </div>
              )}
            </div>
          </details>
        )}

        {product.safetyInformation && (
          <details className="group">
            <summary className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <ShieldCheck className="h-3 w-3 shrink-0" />
              {t('safetyInformation')}
              <span className="ml-auto text-[10px] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <SafeHTML
              html={product.safetyInformation}
              className="mt-1.5 text-xs text-muted-foreground [&_p]:my-0.5"
            />
          </details>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          className="flex-1"
          onClick={handleAddToCart}
          disabled={!canAddToCart}
        >
          <ShoppingCart className="h-4 w-4 mr-1.5" />
          {!canAddToCart && (needsSize || needsColor)
            ? t('selectVariant')
            : t('addToCart')}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart className={cn('h-4 w-4', wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
        </Button>
      </CardFooter>
    </Card>
  )
}
