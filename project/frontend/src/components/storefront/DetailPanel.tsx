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
 * - Tab bar for multiple artifacts
 * - Product images/carousel
 * - Product title, price, rating
 * - Description
 * - Variant selector (size, color)
 * - Add to cart button
 * - "Ask about this product" button (injects question into chat)
 */

import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { X, Star, ShoppingCart, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/currency'
import { useStorefront } from './StorefrontContext'
import { useCart } from '@/hooks/useCart'

interface DetailPanelProps {
  productId?: string
  onClose: () => void
  onAskAbout?: (question: string) => void
}

interface Product {
  id: string
  title: string
  description: string
  category: string
  price: number
  currency: string
  image: string | null
  images: string[]
  rating: number
  reviewCount: number
}

export function DetailPanel({ productId, onClose, onAskAbout }: DetailPanelProps) {
  const t = useTranslations('storefront')
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const { artifacts, activeArtifactId, setActiveArtifactId, removeArtifact } = useStorefront()
  const { addToCart } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch product data for backward compatibility (productId prop)
  useEffect(() => {
    if (!productId) {
      setLoading(false)
      return
    }
    async function fetchProduct() {
      try {
        setLoading(true)
        const response = await fetch(`/api/products/${productId}`)
        if (response.ok) {
          const data = await response.json()
          setProduct(data.product || data)
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

  // If we have artifacts, use the artifact system
  const hasArtifacts = artifacts.length > 0
  const hasMultipleArtifacts = artifacts.length > 1

  const handleAddToCart = async () => {
    if (!product) return
    await addToCart(product.id, 1, undefined, product.title, product.price)
  }

  const handleAskAbout = () => {
    if (product && onAskAbout) {
      onAskAbout(`Tell me more about ${product.title}`)
    }
  }

  const handleCloseTab = (artifactId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeArtifact(artifactId)
  }

  // If using artifacts system
  if (hasArtifacts) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{t('details')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Tabs for multiple artifacts */}
        {hasMultipleArtifacts ? (
          <Tabs
            value={activeArtifactId || artifacts[0].id}
            onValueChange={setActiveArtifactId}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="w-full justify-start rounded-none border-b border-border p-0 h-auto bg-transparent">
              {artifacts.map((artifact) => (
                <TabsTrigger
                  key={artifact.id}
                  value={artifact.id}
                  className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 group"
                >
                  <span className="text-sm truncate max-w-[120px]">{artifact.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleCloseTab(artifact.id, e)}
                    className="ml-2 h-5 w-5 hover:bg-muted rounded-sm p-0.5 opacity-60 hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </TabsTrigger>
              ))}
            </TabsList>

            {artifacts.map((artifact) => (
              <TabsContent
                key={artifact.id}
                value={artifact.id}
                className="flex-1 overflow-hidden mt-0"
              >
                <ArtifactContent artifact={artifact} onAskAbout={onAskAbout} onAddToCart={handleAddToCart} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          // Single artifact - no tabs needed
          <div className="flex-1 overflow-hidden">
            <ArtifactContent artifact={artifacts[0]} onAskAbout={onAskAbout} onAddToCart={handleAddToCart} />
          </div>
        )}
      </div>
    )
  }

  // Backward compatibility: using productId prop
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

  if (!product && !hasArtifacts) {
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

  // If we have a product (backward compatibility), render it
  if (!hasArtifacts && product) {
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

        <ProductView
          product={product}
          locale={locale}
          onAddToCart={handleAddToCart}
          onAskAbout={() => handleAskAbout()}
        />
      </div>
    )
  }

  // Fallback - should not reach here
  return null
}

/**
 * ProductView - Shared product detail template used by both
 * backward-compatible productId path and artifact system
 */
function ProductView({
  product,
  locale,
  onAddToCart,
  onAskAbout,
}: {
  product: { title: string; description?: string; price: number; currency: string; image?: string | null; images?: string[]; rating?: number; reviewCount?: number }
  locale: string
  onAddToCart?: () => void
  onAskAbout?: () => void
}) {
  const t = useTranslations('storefront')
  const image = product.image || (product.images && product.images.length > 0 ? product.images[0] : null)

  return (
    <>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Product Image */}
        <div className="aspect-square w-full rounded-lg bg-muted overflow-hidden">
          {image ? (
            <img src={image} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              {t('noImage')}
            </div>
          )}
        </div>

        {/* Title & Price */}
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">{product.title}</h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">
              {formatPrice(product.price, locale, product.currency)}
            </span>
            <Badge variant="secondary" className="ml-auto">
              <Star className="h-3 w-3 fill-current mr-1" />
              {product.rating || 0}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {product.reviewCount || 0} {t('reviews')}
          </p>
        </div>

        <Separator />

        {/* Description */}
        {product.description && (
          <div>
            <h4 className="font-medium text-foreground mb-2">{t('description')}</h4>
            <p className="text-sm text-muted-foreground">{product.description}</p>
          </div>
        )}

        <Separator />

        {/* Variant Selectors (placeholder) */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">{t('size')}</label>
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
            <label className="text-sm font-medium text-foreground mb-2 block">{t('color')}</label>
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
        <Button className="w-full" size="lg" onClick={onAddToCart}>
          <ShoppingCart className="h-5 w-5 mr-2" />
          {t('addToCart')}
        </Button>

        {onAskAbout && (
          <Button variant="outline" className="w-full" size="lg" onClick={onAskAbout}>
            <MessageCircle className="h-5 w-5 mr-2" />
            {t('askAboutProduct')}
          </Button>
        )}
      </div>
    </>
  )
}

/**
 * ArtifactContent - Renders the content for a single artifact
 */
function ArtifactContent({
  artifact,
  onAskAbout,
  onAddToCart,
}: {
  artifact: { id: string; type: string; title: string; data: any }
  onAskAbout?: (question: string) => void
  onAddToCart?: () => void
}) {
  const params = useParams()
  const locale = (params.locale as string) || 'en'

  // For product artifacts, render the product detail view
  if (artifact.type === 'product' && artifact.data) {
    return (
      <ProductView
        product={artifact.data}
        locale={locale}
        onAddToCart={onAddToCart}
        onAskAbout={onAskAbout ? () => onAskAbout(`Tell me more about ${artifact.data.title}`) : undefined}
      />
    )
  }

  // For other artifact types, render a placeholder
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="text-muted-foreground">
        <h3 className="font-semibold text-foreground mb-2">{artifact.title}</h3>
        <p>Type: {artifact.type}</p>
        <pre className="mt-4 text-xs bg-muted p-2 rounded overflow-auto">
          {JSON.stringify(artifact.data, null, 2)}
        </pre>
      </div>
    </div>
  )
}
