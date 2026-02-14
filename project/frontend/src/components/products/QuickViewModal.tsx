'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Star, Heart, Loader2, Minus, Plus, ShoppingCart, ImageOff } from 'lucide-react'
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
  }
  stock?: number
}

interface QuickViewModalProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickViewModal({ product, open, onOpenChange }: QuickViewModalProps) {
  const t = useTranslations('product')
  const locale = useLocale()
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [imgError, setImgError] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const { addToCart } = useCart()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const wishlisted = isWishlisted(product.id)

  const localizedPrice = getLocalizedPrice(product.price, product.currency, locale)
  const formattedPrice = formatPrice(localizedPrice, locale)

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
                <span className="text-2xl font-bold tracking-tight">{formattedPrice}</span>
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

              {/* Variant selectors — pill/chip style (matching DetailPanel) */}
              {(hasSizes || hasColors) && (
                <>
                  <div className="h-px bg-border/40" />
                  <div className="space-y-3">
                    {hasSizes && (
                      <div>
                        <label className="text-[13px] font-medium text-foreground/80 mb-2 block">
                          {t('size')}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {product.variants!.sizes!.map((size) => (
                            <button
                              key={size}
                              onClick={() => setSelectedSize(selectedSize === size ? '' : size)}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all duration-200',
                                selectedSize === size
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'bg-transparent text-foreground border-border/60 hover:border-border'
                              )}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasColors && (
                      <div>
                        <label className="text-[13px] font-medium text-foreground/80 mb-2 block">
                          {t('color')}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {product.variants!.colors!.map((color) => (
                            <button
                              key={color}
                              onClick={() => setSelectedColor(selectedColor === color ? '' : color)}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all duration-200',
                                selectedColor === color
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'bg-transparent text-foreground border-border/60 hover:border-border'
                              )}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Quantity — +/- stepper (matching DetailPanel) */}
              <div className="h-px bg-border/40" />
              <div className="flex items-center gap-3">
                <label className="text-[13px] font-medium text-foreground/80">{t('quantity')}</label>
                <div className="flex items-center border border-border/60 rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-l-lg rounded-r-none"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-10 text-center text-sm font-medium tabular-nums">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-r-lg rounded-l-none"
                    onClick={() => setQuantity(Math.min(99, quantity + 1))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
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
                href={`/shop/${product.id}`}
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

