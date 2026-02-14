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
 * - Responsive: stacks on mobile
 */

import { Star, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslations, useLocale } from 'next-intl'
import { formatPrice } from '@/lib/currency'
import { useCart } from '@/hooks/useCart'

export interface Product {
  id: string
  title: string
  description?: string
  category: string
  price: number
  currency: string
  image: string | null
  rating: number
  reviewCount: number
}

interface ProductGridArtifactProps {
  products: Product[]
  onSelectProduct: (productId: string) => void
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
    <div
      className={`grid gap-4 ${
        variant === 'inline'
          ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      }`}
    >
      {displayProducts.map((product) => (
        <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardContent className="p-0">
            {/* Product Image */}
            <div className="aspect-square bg-muted relative overflow-hidden group">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  {t('noImage')}
                </div>
              )}
              {/* Category Badge */}
              <Badge className="absolute top-2 left-2" variant="secondary">
                {product.category}
              </Badge>
            </div>

            {/* Product Info */}
            <div className="p-4 space-y-2">
              <h3 className="font-semibold text-sm line-clamp-2 text-foreground">
                {product.title}
              </h3>

              {/* Rating */}
              <div className="flex items-center gap-1 text-xs">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="font-medium text-foreground">{product.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">({product.reviewCount})</span>
              </div>

              {/* Price */}
              <p className="text-lg font-bold text-foreground">
                {formatPrice(product.price, locale, product.currency)}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onSelectProduct(product.id)}
                >
                  {t('viewDetails')}
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    addToCart(product.id, 1, undefined, product.title, product.price)
                  }}
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  {t('add')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
