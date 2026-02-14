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
import { useEffect, useState } from 'react'

interface DetailPanelProps {
  productId: string
  onClose: () => void
  onAskAbout?: (question: string) => void
}

interface Product {
  id: string
  title: string
  description: string
  category: string
  base_price_cents: number
  images: Array<{ src: string }>
  avg_rating: number
  review_count: number
}

export function DetailPanel({ productId, onClose, onAskAbout }: DetailPanelProps) {
  const t = useTranslations('storefront')
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch product data
  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true)
        const response = await fetch(`/api/products/${productId}`)
        if (response.ok) {
          const data = await response.json()
          setProduct(data)
        } else {
          console.error('Failed to fetch product:', response.statusText)
        }
      } catch (error) {
        console.error('Error fetching product:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [productId])

  const handleAskAbout = () => {
    if (product && onAskAbout) {
      onAskAbout(`Tell me more about ${product.title}`)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{t('productDetails')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{t('productDetails')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-destructive">Product not found</div>
        </div>
      </div>
    )
  }

  const price = (product.base_price_cents / 100).toFixed(2)
  const image = product.images && product.images.length > 0 ? product.images[0].src : null

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
        <div className="aspect-square w-full rounded-lg bg-muted overflow-hidden">
          {image ? (
            <img src={image} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
        </div>

        {/* Title & Price */}
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">
            {product.title}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">
              ${price}
            </span>
            <Badge variant="secondary" className="ml-auto">
              <Star className="h-3 w-3 fill-current mr-1" />
              {product.avg_rating || 0}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {product.review_count || 0} {t('reviews')}
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

        <Button variant="outline" className="w-full" size="lg" onClick={handleAskAbout}>
          <MessageCircle className="h-5 w-5 mr-2" />
          {t('askAboutProduct')}
        </Button>
      </div>
    </div>
  )
}
