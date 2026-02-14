'use client'

/**
 * DetailPanel - Right panel for expanded product/design details
 *
 * Activated by:
 * - Clicking inline artifacts in chat
 * - Clicking sidebar product cards
 *
 * Contains:
 * - Close button
 * - Product images/carousel
 * - Product title, price, rating
 * - Description
 * - Variant selector (size, color)
 * - Add to cart button
 * - "Ask about this product" button (injects question into chat)
 */

import { useTranslations } from 'next-intl'
import { X, Star, ShoppingCart, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface DetailPanelProps {
  productId: string
  onClose: () => void
}

export function DetailPanel({ productId, onClose }: DetailPanelProps) {
  const t = useTranslations('storefront')

  // Mock product data - will be replaced with real data fetch
  const product = {
    title: 'Classic T-Shirt',
    price: '$24.99',
    rating: 4.5,
    reviewCount: 128,
    description: 'Premium cotton t-shirt with custom print. Soft, comfortable, and durable.',
    images: ['/placeholder.jpg'],
  }

  return (
    <div className="flex flex-col h-full w-full bg-card">
      {/* Header with close button */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">{t('productDetails')}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="flex-shrink-0"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Product Image */}
        <div className="aspect-square w-full rounded-lg bg-muted" />

        {/* Title & Price */}
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">
            {product.title}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">
              {product.price}
            </span>
            <Badge variant="secondary" className="ml-auto">
              <Star className="h-3 w-3 fill-current mr-1" />
              {product.rating}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {product.reviewCount} {t('reviews')}
          </p>
        </div>

        <Separator />

        {/* Description */}
        <div>
          <h4 className="font-medium text-foreground mb-2">{t('description')}</h4>
          <p className="text-sm text-muted-foreground">
            {product.description}
          </p>
        </div>

        <Separator />

        {/* Variant Selectors (placeholder) */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t('size')}
            </label>
            <div className="flex gap-2">
              {['S', 'M', 'L', 'XL'].map((size) => (
                <Button
                  key={size}
                  variant={size === 'M' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t('color')}
            </label>
            <div className="flex gap-2">
              {['Black', 'White', 'Navy'].map((color) => (
                <Button
                  key={color}
                  variant={color === 'Black' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                >
                  {color}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button className="w-full" size="lg">
          <ShoppingCart className="h-5 w-5 mr-2" />
          {t('addToCart')}
        </Button>

        <Button variant="outline" className="w-full" size="lg">
          <MessageCircle className="h-5 w-5 mr-2" />
          {t('askAboutProduct')}
        </Button>
      </div>
    </div>
  )
}
