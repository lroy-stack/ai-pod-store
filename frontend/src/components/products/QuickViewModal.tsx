'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Star, Heart, Loader2, ShoppingCart, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'
import { useCart } from '@/hooks/useCart'
import { useWishlist } from '@/hooks/useWishlist'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { VariantSelector } from '@/components/products/VariantSelector'
import { QuantitySelector } from '@/components/products/QuantitySelector'
import type { ProductCard } from '@/types/product'

interface QuickViewModalProps {
  product: ProductCard
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickViewModal({ product, open, onOpenChange }: QuickViewModalProps) {
  const t = useTranslations('product')
  const locale = useLocale()
  // Auto-select when only 1 option exists
  const [selectedSize, setSelectedSize] = useState<string>(
    product.variants?.sizes?.length === 1 ? product.variants.sizes[0] : ''
  )
  const [selectedColor, setSelectedColor] = useState<string>(
    product.variants?.colors?.length === 1 ? product.variants.colors[0] : ''
  )
  const [quantity, setQuantity] = useState(1)

  // Reset selections when product changes
  useEffect(() => {
    setSelectedSize(product.variants?.sizes?.length === 1 ? product.variants.sizes[0] : '')
    setSelectedColor(product.variants?.colors?.length === 1 ? product.variants.colors[0] : '')
    setQuantity(1)
    setImgError(false)
  }, [product.id])

  const [imgError, setImgError] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const { addToCart } = useCart()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const wishlisted = isWishlisted(product.id)

  const localizedPrice = getLocalizedPrice(product.price, product.currency, locale)
  const formattedPrice = formatPrice(localizedPrice, locale)
  const showFromPrice = product.hasVariantPricing === true

  const hasSizes = (product.variants?.sizes?.length ?? 0) > 0
  const hasColors = (product.variants?.colors?.length ?? 0) > 0

  const handleAddToCart = async () => {
    setIsAddingToCart(true)
    try {
      await addToCart(
        product.id,
        quantity,
        { size: selectedSize || undefined, color: selectedColor || undefined },
        product.title,
        product.price
      )
      onOpenChange(false)
    } catch {
      // Error toast is handled by useCart hook
    } finally {
      setIsAddingToCart(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl max-h-[90dvh]">
        <DialogHeader className="sr-only">
          <DialogTitle>{product.title}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 max-h-[90dvh]">
          {/* Image — smaller on mobile, square on desktop */}
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-full bg-muted overflow-hidden">
            {product.image && !imgError ? (
              <Image
                src={product.image}
                alt={product.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2 min-h-[200px]">
                <ImageOff className="h-10 w-10" />
                <span className="text-xs font-medium text-muted-foreground/60">{product.title}</span>
              </div>
            )}

            {/* Category pill */}
            {product.category && (
              <span className="absolute top-3 left-3 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-background/70 text-foreground/80 backdrop-blur-md border border-border/30">
                {product.category}
              </span>
            )}
          </div>

          {/* Details — scrollable */}
          <div className="flex flex-col overflow-y-auto detail-scroll">
            <div className="px-5 py-4 space-y-4 flex-1">
              {/* Title + Rating */}
              <div>
                <h2 className="text-lg font-semibold leading-snug tracking-tight">
                  {product.title}
                </h2>
                {product.rating && product.rating > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            'size-3.5',
                            s <= Math.round(product.rating || 0)
                              ? 'fill-rating text-rating'
                              : 'text-muted-foreground/25'
                          )}
                        />
                      ))}
                    </div>
                    {product.reviewCount ? (
                      <span className="text-xs text-muted-foreground">
                        ({product.reviewCount})
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Price + Stock */}
              <div className="flex items-center gap-3">
                {product.compareAtPrice ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm line-through text-muted-foreground">
                        {formatPrice(getLocalizedPrice(product.compareAtPrice, product.currency, locale), locale)}
                      </span>
                      {(() => {
                        const pct = Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
                        return pct > 0 ? (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0.5">-{pct}%</Badge>
                        ) : null
                      })()}
                    </div>
                    <span className="text-2xl font-bold tracking-tight text-destructive">
                      {formattedPrice}
                    </span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold tracking-tight">
                    {showFromPrice && (
                      <span className="text-sm font-normal text-muted-foreground mr-1">{t('fromPrice')}</span>
                    )}
                    {formattedPrice}
                  </span>
                )}
                {product.stock !== undefined && product.stock > 0 && (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                    {t('inStock')}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {product.description}
              </p>

              {/* Variant Selectors */}
              {(hasSizes || hasColors) && (
                <>
                  <div className="h-px bg-border/40" />
                  <VariantSelector
                    allSizes={product.variants?.sizes}
                    allColors={product.variants?.colors}
                    selectedSize={selectedSize}
                    selectedColor={selectedColor}
                    onSizeChange={(s) => setSelectedSize(s === selectedSize ? '' : s)}
                    onColorChange={(c) => setSelectedColor(c === selectedColor ? '' : c)}
                    sizeLabel={t('size')}
                    colorLabel={t('color')}
                  />
                </>
              )}

              {/* Quantity */}
              <div className="h-px bg-border/40" />
              <QuantitySelector
                quantity={quantity}
                onQuantityChange={setQuantity}
                label={t('quantity')}
              />
            </div>

            {/* Footer — sticky actions */}
            <div className="px-5 py-4 border-t border-border/40 space-y-2">
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-11 text-sm font-semibold"
                  onClick={handleAddToCart}
                  disabled={
                    isAddingToCart ||
                    (hasSizes && !selectedSize) ||
                    (hasColors && !selectedColor)
                  }
                >
                  {isAddingToCart ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ShoppingCart className="h-4 w-4 mr-2" />
                  )}
                  {t('addToCart')}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 flex-shrink-0 rounded-lg"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label={wishlisted ? t('removeFromWishlist') : t('addToWishlist')}
                >
                  <Heart
                    className={cn(
                      'size-4',
                      wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground'
                    )}
                  />
                </Button>
              </div>
              <Link
                href={`/shop/${product.slug}`}
                className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                onClick={() => onOpenChange(false)}
              >
                {t('viewFullDetails')}
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
