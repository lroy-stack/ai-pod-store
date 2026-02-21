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

import { Star, ShoppingCart, Heart, Package, Ruler, Info, Shirt, Globe, Printer, Droplets, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTranslations, useLocale } from 'next-intl'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useWishlist } from '@/hooks/useWishlist'

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
  const { isWishlisted, toggleWishlist } = useWishlist()
  const wishlisted = isWishlisted(product.id)

  return (
    <Card className="overflow-hidden">
      <div className={cn('grid gap-6', variant === 'full' ? 'md:grid-cols-2' : 'md:grid-cols-[300px_1fr]')}>
        {/* Product Image */}
        <div className="aspect-square bg-muted">
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0].src}
              alt={product.images[0].alt || product.title}
              className="h-full w-full object-cover"
              width={300}
              height={300}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
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
                    <Star className="h-4 w-4 fill-rating text-rating" />
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
                {t('description')}
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

            {/* Materials & Specifications */}
            {(product.materials || product.careInstructions || product.printTechnique || product.manufacturingCountry) && (
              <>
                <div className="space-y-2">
                  {product.materials && (
                    <div className="flex items-start gap-2">
                      <Shirt className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold">{t('materials')}</h3>
                        <p className="text-sm text-muted-foreground">{product.materials}</p>
                      </div>
                    </div>
                  )}

                  {product.careInstructions && (
                    <div className="flex items-start gap-2">
                      <Droplets className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold">{t('careInstructions')}</h3>
                        <p className="text-sm text-muted-foreground">{product.careInstructions}</p>
                      </div>
                    </div>
                  )}

                  {product.printTechnique && (
                    <div className="flex items-start gap-2">
                      <Printer className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold">{t('printTechnique')}</h3>
                        <p className="text-sm text-muted-foreground">{product.printTechnique}</p>
                      </div>
                    </div>
                  )}

                  {product.manufacturingCountry && (
                    <div className="flex items-start gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold">{t('madeIn')}</h3>
                        <p className="text-sm text-muted-foreground">{product.manufacturingCountry}</p>
                      </div>
                    </div>
                  )}
                </div>

                {product.safetyInformation && (
                  <details className="group mt-2">
                    <summary className="flex items-center gap-2 cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      {t('safetyInformation')}
                      <span className="ml-auto text-[10px] group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div
                      className="mt-1.5 text-xs text-muted-foreground [&_p]:my-0.5 [&_strong]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: product.safetyInformation }}
                    />
                  </details>
                )}

                <Separator />
              </>
            )}

            {/* Shipping Info */}
            {product.shippingInfo && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4" />
                  {t('shipping')}
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
              {product.available ? t('addToCart') : t('outOfStock')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => toggleWishlist(product.id)}
            >
              <Heart className={cn('h-4 w-4', wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
            </Button>
          </CardFooter>
        </div>
      </div>
    </Card>
  )
}
