'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Star, Heart, X, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const [isWishlisted, setIsWishlisted] = useState(false)

  // Convert price to locale's currency and format it
  const localizedPrice = getLocalizedPrice(product.price, product.currency, locale)
  const formattedPrice = formatPrice(localizedPrice, locale)

  const renderStars = (rating: number = 0) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'size-4',
              star <= Math.round(rating)
                ? 'fill-rating text-rating'
                : 'text-muted-foreground/50'
            )}
          />
        ))}
      </div>
    )
  }

  const handleAddToCart = () => {
    // TODO: Implement add to cart functionality
    console.log('Add to cart:', { product, selectedSize, selectedColor, quantity })
  }

  const toggleWishlist = () => {
    setIsWishlisted(!isWishlisted)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{product.title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Product Image */}
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {product.title}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">{product.title}</h2>

              {/* Rating */}
              {product.rating && (
                <div className="flex items-center gap-2 mb-3">
                  {renderStars(product.rating)}
                  {product.reviewCount && (
                    <span className="text-sm text-muted-foreground">
                      ({product.reviewCount} {t('reviews')})
                    </span>
                  )}
                </div>
              )}

              {/* Price */}
              <div className="flex items-center gap-3 mb-4">
                <p className="text-3xl font-bold">{formattedPrice}</p>
                {product.stock !== undefined && product.stock > 0 && (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    {t('inStock')}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-muted-foreground mb-6">
                {product.description}
              </p>
            </div>

            {/* Variant Selectors */}
            <div className="space-y-4">
              {/* Size Selector */}
              {product.variants?.sizes && product.variants.sizes.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t('size')}
                  </label>
                  <Select value={selectedSize} onValueChange={setSelectedSize}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectSize')} />
                    </SelectTrigger>
                    <SelectContent>
                      {product.variants.sizes.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Color Selector */}
              {product.variants?.colors && product.variants.colors.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t('color')}
                  </label>
                  <Select value={selectedColor} onValueChange={setSelectedColor}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectColor')} />
                    </SelectTrigger>
                    <SelectContent>
                      {product.variants.colors.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quantity Selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('quantity')}
                </label>
                <Select
                  value={quantity.toString()}
                  onValueChange={(val) => setQuantity(parseInt(val))}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-auto pt-4">
              <Button
                className="flex-1"
                onClick={handleAddToCart}
                disabled={
                  (product.variants?.sizes && !selectedSize) ||
                  (product.variants?.colors && !selectedColor)
                }
              >
                {t('addToCart')}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleWishlist}
                aria-label={isWishlisted ? t('removeFromWishlist') : t('addToWishlist')}
              >
                <Heart
                  className={cn(
                    'size-5',
                    isWishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground'
                  )}
                />
              </Button>
            </div>

            {/* View Full Details Link */}
            <Link
              href={`/shop/${product.id}`}
              className="text-sm text-primary hover:underline text-center"
              onClick={() => onOpenChange(false)}
            >
              {t('viewFullDetails')}
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Quick View Button Component
interface QuickViewButtonProps {
  onClick: (e: React.MouseEvent) => void
}

export function QuickViewButton({ onClick }: QuickViewButtonProps) {
  const t = useTranslations('product')

  return (
    <Button
      variant="secondary"
      size="sm"
      className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-card/95 backdrop-blur-sm hover:bg-card"
      onClick={onClick}
    >
      <Eye className="size-4 mr-2" />
      {t('quickView')}
    </Button>
  )
}
