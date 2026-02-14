'use client'

/**
 * ComparisonTableArtifact - Compare multiple products in a table
 *
 * Tools that use this artifact:
 * - compare_products
 *
 * Features:
 * - InlineCompact: Horizontal scrollable table within chat message
 * - Compares: price, rating, features, availability
 * - Action buttons: "Add to Cart" per product
 * - Responsive: scrollable on mobile
 */

import { Star, ShoppingCart, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export interface ComparisonProduct {
  id: string
  title: string
  category: string
  price: number
  currency: string
  image: string | null
  rating: number
  reviewCount: number
  available: boolean
  features?: string[]
}

interface ComparisonTableArtifactProps {
  products: ComparisonProduct[]
  onAddToCart?: (productId: string) => void
  variant?: 'inline' | 'full'
}

export function ComparisonTableArtifact({
  products,
  onAddToCart,
  variant = 'inline',
}: ComparisonTableArtifactProps) {
  const t = useTranslations('storefront')

  // Collect all unique features across all products
  const allFeatures = Array.from(
    new Set(products.flatMap((p) => p.features || []))
  )

  return (
    <Card className={cn('overflow-hidden', variant === 'inline' && 'max-w-4xl')}>
      <CardHeader>
        <CardTitle className="text-xl">Product Comparison</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 p-4 text-left text-sm font-semibold">
                  Feature
                </th>
                {products.map((product) => (
                  <th key={product.id} className="min-w-[200px] p-4 text-center">
                    <div className="space-y-2">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="mx-auto h-24 w-24 rounded object-cover"
                          width={96}
                          height={96}
                        />
                      ) : (
                        <div className="mx-auto h-24 w-24 rounded bg-muted" />
                      )}
                      <div className="text-sm font-semibold">{product.title}</div>
                      <Badge variant="secondary" className="text-xs">
                        {product.category}
                      </Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Price row */}
              <tr className="border-b hover:bg-muted/50">
                <td className="sticky left-0 z-10 bg-card p-4 text-sm font-medium">
                  Price
                </td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center">
                    <div className="text-lg font-bold">
                      {new Intl.NumberFormat('de-DE', {
                        style: 'currency',
                        currency: product.currency || 'EUR',
                      }).format(product.price)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Rating row */}
              <tr className="border-b hover:bg-muted/50">
                <td className="sticky left-0 z-10 bg-card p-4 text-sm font-medium">
                  Rating
                </td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center">
                    {product.rating > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{product.rating.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">
                          ({product.reviewCount})
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No reviews</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Availability row */}
              <tr className="border-b hover:bg-muted/50">
                <td className="sticky left-0 z-10 bg-card p-4 text-sm font-medium">
                  Availability
                </td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center">
                    {product.available ? (
                      <Badge variant="default" className="gap-1">
                        <Check className="h-3 w-3" />
                        In Stock
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <X className="h-3 w-3" />
                        Out of Stock
                      </Badge>
                    )}
                  </td>
                ))}
              </tr>

              {/* Feature rows */}
              {allFeatures.length > 0 &&
                allFeatures.map((feature) => (
                  <tr key={feature} className="border-b hover:bg-muted/50">
                    <td className="sticky left-0 z-10 bg-card p-4 text-sm font-medium">
                      {feature}
                    </td>
                    {products.map((product) => (
                      <td key={product.id} className="p-4 text-center">
                        {product.features?.includes(feature) ? (
                          <Check className="mx-auto h-5 w-5 text-green-600" />
                        ) : (
                          <X className="mx-auto h-5 w-5 text-muted-foreground" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}

              {/* Action row */}
              <tr className="bg-muted/50">
                <td className="sticky left-0 z-10 bg-muted/50 p-4 text-sm font-medium">
                  Action
                </td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center">
                    <Button
                      onClick={() => onAddToCart?.(product.id)}
                      disabled={!product.available}
                      className="w-full"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Add to Cart
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
