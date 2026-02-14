'use client'

/**
 * ProductDetailArtifact - Display detailed product information as a card
 *
 * Tools that use this artifact:
 * - get_product_detail
 *
 * Features:
 * - InlineCompact: Card layout within chat message
 * - Shows: full description, variants, sizes, materials, shipping info
 * - Action buttons: "Add to Cart", "Add to Wishlist"
 * - Responsive: stacks on mobile
 */

import { Star, ShoppingCart, Heart, Package, Ruler, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTranslations, useLocale } from 'next-intl'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'

export interface ProductDetail {
  id: string
  title: string
  description: string
  category: string
  price: number
  currency: string
  images: { src: string; alt: string }[]
  rating: number
  reviewCount: number
  variants?: { name: string; options: string[] }[]
  materials?: string
  shippingInfo?: string
  available: boolean
}

interface ProductDetailArtifactProps {
  product: ProductDetail
  onAddToCart?: (productId: string) => void
  onAddToWishlist?: (productId: string) => void
  variant?: 'inline' | 'full'
}

export function ProductDetailArtifact({
  product,
  onAddToCart,
  onAddToWishlist,
  variant = 'inline',
}: ProductDetailArtifactProps) {
  const t = useTranslations('storefront')
  const locale = useLocale()

  return (
    <Card className={cn('overflow-hidden', variant === 'inline' && 'max-w-2xl')}>
      <div className={cn('grid gap-6', variant === 'full' ? 'md:grid-cols-2' : 'md:grid-cols-[300px_1fr]')}>
        {/* Product Image */}
        <div className="bg-muted">
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0].src}
              alt={product.images[0].alt || product.title}
              className="h-full w-full object-cover"
              width={300}
              height={300}
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-2xl">{product.title}</CardTitle>
                <Badge variant="secondary" className="mt-2">
                  {product.category}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {formatPrice(product.price, locale, product.currency)}
                </div>
                {product.rating > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{product.rating.toFixed(1)}</span>
                    <span>({product.reviewCount})</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            {/* Description */}
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Info className="h-4 w-4" />
                Description
              </h3>
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>

            <Separator />

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <>
                <div className="space-y-2">
                  {product.variants.map((variant) => (
                    <div key={variant.name}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Ruler className="h-4 w-4" />
                        {variant.name}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {variant.options.map((option) => (
                          <Badge key={option} variant="outline">
                            {option}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
              </>
            )}

            {/* Materials */}
            {product.materials && (
              <>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Materials</h3>
                  <p className="text-sm text-muted-foreground">{product.materials}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Shipping Info */}
            {product.shippingInfo && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4" />
                  Shipping
                </h3>
                <p className="text-sm text-muted-foreground">{product.shippingInfo}</p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => onAddToCart?.(product.id)}
              disabled={!product.available}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {product.available ? 'Add to Cart' : 'Out of Stock'}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onAddToWishlist?.(product.id)}
            >
              <Heart className="h-4 w-4" />
            </Button>
          </CardFooter>
        </div>
      </div>
    </Card>
  )
}
