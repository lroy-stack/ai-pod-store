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
 * - Variant selector (size, color) — dynamic from product data
 * - Add to cart button
 * - "Ask about this product" button (injects question into chat)
 */

import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { X, Star, ShoppingCart, MessageCircle, ImageOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/currency'
import { useStorefront } from './StorefrontContext'
import { useCart } from '@/hooks/useCart'
import { cn } from '@/lib/utils'

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
  variants?: {
    sizes?: string[]
    colors?: string[]
  }
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

  const handleAddToCart = async (variants?: { size?: string; color?: string }) => {
    if (!product) return
    await addToCart(product.id, 1, variants, product.title, product.price)
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

  // Reusable panel header
  const PanelHeader = ({ title }: { title: string }) => (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
      <h2 className="font-semibold text-[15px] text-foreground tracking-tight">{title}</h2>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="h-8 w-8 rounded-full hover:bg-muted/80 flex-shrink-0"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </Button>
    </div>
  )

  // If using artifacts system
  if (hasArtifacts) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <PanelHeader title={t('details')} />

        {/* Tabs for multiple artifacts */}
        {hasMultipleArtifacts ? (
          <Tabs
            value={activeArtifactId || artifacts[0].id}
            onValueChange={setActiveArtifactId}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="w-full justify-start rounded-none border-b border-border/40 p-0 h-auto bg-transparent">
              {artifacts.map((artifact) => (
                <TabsTrigger
                  key={artifact.id}
                  value={artifact.id}
                  className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2.5 group hover:bg-muted/30 transition-colors"
                >
                  <span className="text-[13px] font-medium truncate max-w-[140px]">{artifact.title}</span>
                  <button
                    onClick={(e) => handleCloseTab(artifact.id, e)}
                    className="ml-2 h-4 w-4 rounded-full opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all inline-flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </TabsTrigger>
              ))}
            </TabsList>

            {artifacts.map((artifact) => (
              <TabsContent
                key={artifact.id}
                value={artifact.id}
                className="flex-1 min-h-0 mt-0 flex flex-col"
              >
                <ArtifactContent artifact={artifact} onAskAbout={onAskAbout} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          // Single artifact - no tabs needed
          <div className="flex-1 min-h-0 flex flex-col">
            <ArtifactContent artifact={artifacts[0]} onAskAbout={onAskAbout} />
          </div>
        )}
      </div>
    )
  }

  // Backward compatibility: using productId prop — loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <PanelHeader title={t('productDetails')} />
        <div className="flex-1 p-5 space-y-4">
          <div className="aspect-[4/3] w-full bg-muted/30 rounded-2xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-3/4 bg-muted/30 rounded-lg animate-pulse" />
            <div className="h-4 w-1/3 bg-muted/30 rounded-lg animate-pulse" />
            <div className="h-7 w-1/2 bg-muted/30 rounded-lg animate-pulse" />
          </div>
          <div className="h-px bg-border/30" />
          <div className="h-16 w-full bg-muted/30 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  // Error state — product not found
  if (!product && !hasArtifacts) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <PanelHeader title={t('productDetails')} />
        <div className="flex-1 flex items-center justify-center p-5">
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-foreground">Product not found</p>
              <p className="text-sm text-muted-foreground mt-1">
                This product may have been removed or is unavailable.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If we have a product (backward compatibility), render it
  if (!hasArtifacts && product) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <PanelHeader title={t('productDetails')} />
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
  product: {
    title: string
    description?: string
    price: number
    currency: string
    image?: string | null
    images?: string[]
    rating?: number
    reviewCount?: number
    variants?: { sizes?: string[]; colors?: string[] }
  }
  locale: string
  onAddToCart?: (variants?: { size?: string; color?: string }) => void
  onAskAbout?: () => void
}) {
  const t = useTranslations('storefront')
  const image = product.image || (product.images && product.images.length > 0 ? product.images[0] : null)
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedColor, setSelectedColor] = useState('')

  const hasSizes = (product.variants?.sizes?.length ?? 0) > 0
  const hasColors = (product.variants?.colors?.length ?? 0) > 0

  const handleAddToCart = () => {
    const variants: { size?: string; color?: string } = {}
    if (selectedSize) variants.size = selectedSize
    if (selectedColor) variants.color = selectedColor
    onAddToCart?.(Object.keys(variants).length > 0 ? variants : undefined)
  }

  return (
    <>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto detail-scroll px-5 py-4 space-y-4">
        {/* Product Image */}
        <div className="aspect-[4/3] w-full rounded-2xl bg-muted overflow-hidden relative group/img">
          {image ? (
            <img
              src={image}
              alt={product.title}
              className="w-full h-full object-cover group-hover/img:scale-[1.03] transition-transform duration-500 ease-out"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
              <ImageOff className="h-12 w-12" />
            </div>
          )}
        </div>

        {/* Title, Rating & Price */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold leading-snug text-foreground tracking-tight">
            {product.title}
          </h3>
          <div className="flex items-center gap-1">
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
            <span className="text-xs text-muted-foreground ml-1">
              ({product.reviewCount || 0})
            </span>
          </div>
          <span className="text-2xl font-bold text-foreground tracking-tight block">
            {formatPrice(product.price, locale, product.currency)}
          </span>
        </div>

        {/* Description */}
        {product.description && (
          <>
            <div className="h-px bg-border/40" />
            <div>
              <h4 className="text-[13px] font-medium text-foreground/80 mb-1.5">{t('description')}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
            </div>
          </>
        )}

        {/* Dynamic Variant Selectors */}
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
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-4 border-t border-border/40 space-y-2">
        <Button className="w-full h-11 text-sm font-semibold" onClick={handleAddToCart}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          {t('addToCart')}
        </Button>
        {onAskAbout && (
          <Button
            variant="ghost"
            className="w-full h-10 text-sm text-muted-foreground hover:text-foreground"
            onClick={onAskAbout}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {t('askAboutProduct')}
          </Button>
        )}
      </div>
    </>
  )
}

/**
 * ArtifactContent - Renders the content for a single artifact
 * Fetches product data from API when artifact only contains an id
 */
function ArtifactContent({
  artifact,
  onAskAbout,
}: {
  artifact: { id: string; type: string; title: string; data: any }
  onAskAbout?: (question: string) => void
}) {
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const { addToCart } = useCart()
  const [fetchedProduct, setFetchedProduct] = useState<any>(null)
  const [fetchLoading, setFetchLoading] = useState(false)

  // If product artifact has incomplete data (only id), fetch the full product
  const hasFullData = artifact.data?.title && artifact.data?.price !== undefined
  useEffect(() => {
    if (artifact.type === 'product' && artifact.data?.id && !hasFullData && !fetchedProduct && !fetchLoading) {
      setFetchLoading(true)
      fetch(`/api/products/${artifact.data.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setFetchedProduct(data.product || data)
        })
        .catch(() => {})
        .finally(() => setFetchLoading(false))
    }
  }, [artifact.data?.id, artifact.type, hasFullData, fetchedProduct, fetchLoading])

  // For product artifacts, render the product detail view
  if (artifact.type === 'product') {
    const productData = hasFullData ? artifact.data : fetchedProduct

    if (fetchLoading || (!productData && !hasFullData)) {
      return (
        <div className="flex-1 p-5 space-y-4">
          <div className="aspect-[4/3] w-full bg-muted/30 rounded-2xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-3/4 bg-muted/30 rounded-lg animate-pulse" />
            <div className="h-4 w-1/3 bg-muted/30 rounded-lg animate-pulse" />
            <div className="h-7 w-1/2 bg-muted/30 rounded-lg animate-pulse" />
          </div>
          <div className="h-px bg-border/30" />
          <div className="h-16 w-full bg-muted/30 rounded-xl animate-pulse" />
        </div>
      )
    }

    if (productData) {
      const handleAddToCart = (variants?: { size?: string; color?: string }) => {
        addToCart(productData.id, 1, variants, productData.title, productData.price)
      }

      return (
        <ProductView
          product={productData}
          locale={locale}
          onAddToCart={handleAddToCart}
          onAskAbout={onAskAbout ? () => onAskAbout(`Tell me more about ${productData.title}`) : undefined}
        />
      )
    }
  }

  // Design artifacts — show image + prompt
  if (artifact.type === 'design') {
    return (
      <div className="flex-1 overflow-y-auto detail-scroll p-5 space-y-4">
        <h3 className="font-semibold text-foreground text-[15px]">{artifact.title}</h3>
        {artifact.data?.image && (
          <div className="aspect-[4/3] w-full rounded-2xl bg-muted overflow-hidden">
            <img src={artifact.data.image} alt={artifact.title} className="w-full h-full object-cover" />
          </div>
        )}
        {artifact.data?.prompt && (
          <p className="text-sm text-muted-foreground leading-relaxed">{artifact.data.prompt}</p>
        )}
      </div>
    )
  }

  // Other artifact types — formatted JSON
  return (
    <div className="flex-1 overflow-y-auto detail-scroll p-5 space-y-3">
      <h3 className="font-semibold text-foreground text-[15px]">{artifact.title}</h3>
      <p className="text-xs text-muted-foreground">Type: {artifact.type}</p>
      <pre className="text-xs bg-muted/30 border border-border/40 p-3 rounded-xl overflow-auto whitespace-pre-wrap break-words">
        {JSON.stringify(artifact.data, null, 2)}
      </pre>
    </div>
  )
}
