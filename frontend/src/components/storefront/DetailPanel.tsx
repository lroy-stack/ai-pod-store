'use client'

/**
 * DetailPanel - Right panel for expanded product/design details
 *
 * Activated by:
 * - Clicking inline artifacts in chat
 * - Clicking sidebar product cards
 *
 * Sub-components imported from @/components/products/:
 * - ProductImageGallery, ProductSpecifications, VariantSelector, QuantitySelector
 */

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { X, Star, ShoppingCart, MessageCircle, AlertCircle, Heart, Paintbrush2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useEffect, useState, useMemo, memo } from 'react'
import { formatPrice } from '@/lib/currency'
import { useStorefront } from './StorefrontContext'
import { useProductDetail } from '@/hooks/useProductDetail'
import { useCart } from '@/hooks/useCart'
import { useWishlist } from '@/hooks/useWishlist'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ProductImageGallery } from '@/components/products/ProductImageGallery'
import { ProductSpecifications } from '@/components/products/ProductSpecifications'
import { VariantSelector } from '@/components/products/VariantSelector'
import { QuantitySelector } from '@/components/products/QuantitySelector'
import type { ProductDetail } from '@/types/product'

// ─── Module-level helper components ──────────────────────

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 h-14 border-b border-border">
      <h2 className="font-semibold text-sm text-foreground tracking-tight">{title}</h2>
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
}

function DetailPanelSkeleton() {
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

// ─── Main export ─────────────────────────────────────────

interface DetailPanelProps {
  productId?: string
  onClose: () => void
  onAskAbout?: (question: string) => void
}

export function DetailPanel({ productId, onClose, onAskAbout }: DetailPanelProps) {
  const t = useTranslations('storefront')
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const { artifacts, activeArtifactId, setActiveArtifactId, removeArtifact } = useStorefront()
  const { addToCart } = useCart()

  // Backward-compat: fetch product by productId prop when no artifact covers it
  const skipLegacyFetch = !productId || artifacts.some(a => a.type === 'product' && a.data?.id === productId)
  const { product, loading } = useProductDetail(skipLegacyFetch ? null : productId, locale)

  const hasArtifacts = artifacts.length > 0
  const hasMultipleArtifacts = artifacts.length > 1

  const handleAddToCart = async (quantity: number, variants?: { size?: string; color?: string }) => {
    if (!product) return
    // Look up variant-specific price if available
    let price = product.price
    if (variants && product.variants?.prices) {
      const match = product.variants.prices.find(
        (vp: { size: string; color: string; price: number }) =>
          vp.size === (variants.size || '') && vp.color === (variants.color || '')
      )
      if (match) price = match.price
    }
    await addToCart(product.id, quantity, variants, product.title, price)
  }

  const handleAskAbout = () => {
    if (product && onAskAbout) {
      onAskAbout(t('askAboutProduct', { title: product.title }))
    }
  }

  const handleCloseTab = (artifactId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeArtifact(artifactId)
  }

  // Artifact system — tabs for multiple artifacts
  if (hasArtifacts) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <PanelHeader title={t('details')} onClose={onClose} />

        {hasMultipleArtifacts ? (
          <Tabs
            value={activeArtifactId || artifacts[0].id}
            onValueChange={setActiveArtifactId}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="w-full justify-start rounded-none border-b border-border/40 px-1 h-auto bg-transparent overflow-x-auto tab-scroll flex-nowrap gap-0">
              {artifacts.map((artifact) => (
                <TabsTrigger
                  key={artifact.id}
                  value={artifact.id}
                  className="relative rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/40 px-3.5 py-2 group hover:bg-muted/30 transition-all duration-200 gap-1.5 max-w-[180px]"
                >
                  <span className="text-[13px] font-medium truncate">{artifact.title}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleCloseTab(artifact.id, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCloseTab(artifact.id, e as any) } }}
                    className="ml-1 h-4 w-4 rounded-full opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all duration-150 inline-flex items-center justify-center flex-shrink-0"
                    aria-label={`Close ${artifact.title}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
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
          <div className="flex-1 min-h-0 flex flex-col">
            <ArtifactContent artifact={artifacts[0]} onAskAbout={onAskAbout} />
          </div>
        )}
      </div>
    )
  }

  // Backward-compat loading
  if (loading) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <PanelHeader title={t('productDetails')} onClose={onClose} />
        <DetailPanelSkeleton />
      </div>
    )
  }

  // Error state
  if (!product && !hasArtifacts) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <PanelHeader title={t('productDetails')} onClose={onClose} />
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

  // Backward-compat product render
  if (!hasArtifacts && product) {
    return (
      <div className="flex flex-col h-full w-full bg-card">
        <PanelHeader title={t('productDetails')} onClose={onClose} />
        <ProductView
          product={product}
          locale={locale}
          onAddToCart={handleAddToCart}
          onAskAbout={() => handleAskAbout()}
        />
      </div>
    )
  }

  return null
}

// ─── ProductView ─────────────────────────────────────────

const ProductView = memo(function ProductView({
  product,
  locale,
  onAddToCart,
  onAskAbout,
}: {
  product: ProductDetail
  locale: string
  onAddToCart?: (quantity: number, variants?: { size?: string; color?: string }) => void
  onAskAbout?: () => void
}) {
  const t = useTranslations('storefront')
  const { isWishlisted, toggleWishlist } = useWishlist()

  // Variant-to-image mappings
  const colorImageIndices = product.variants?.colorImageIndices
  const sizeImageIndices = product.variants?.sizeImageIndices
  const hasColorMapping = !!(colorImageIndices && Object.keys(colorImageIndices).length > 0)
  const hasSizeMapping = !!(sizeImageIndices && Object.keys(sizeImageIndices).length > 0)

  const allColors = product.variants?.allColors || product.variants?.colors
  const allSizes = product.variants?.allSizes || product.variants?.sizes
  const unavailableCombinations = product.variants?.unavailableCombinations || []
  const availableColorSet = new Set(product.variants?.colors || [])
  const availableSizeSet = new Set(product.variants?.sizes || [])

  // Auto-select: single option always, or first option when image mapping exists
  const [selectedSize, setSelectedSize] = useState(
    product.variants?.sizes?.length === 1
      ? product.variants.sizes[0]
      : (hasSizeMapping && product.variants?.sizes?.[0] || '')
  )
  const [selectedColor, setSelectedColor] = useState(
    product.variants?.colors?.length === 1
      ? product.variants.colors[0]
      : (hasColorMapping && product.variants?.colors?.[0] || '')
  )
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [quantity, setQuantity] = useState(1)

  // Filter visible images based on selected variant
  const visibleImages = useMemo(() => {
    if (hasColorMapping && selectedColor && colorImageIndices?.[selectedColor]) {
      return colorImageIndices[selectedColor].map(idx => product.images?.[idx]).filter(Boolean) as string[]
    }
    if (hasSizeMapping && selectedSize && sizeImageIndices?.[selectedSize]) {
      return sizeImageIndices[selectedSize].map(idx => product.images?.[idx]).filter(Boolean) as string[]
    }
    if (product.images && product.images.length > 0) {
      return product.images.filter(Boolean)
    }
    return product.image ? [product.image] : []
  }, [selectedColor, selectedSize, product.images, product.image, colorImageIndices, sizeImageIndices, hasColorMapping, hasSizeMapping])

  // Reset image index when variant changes
  useEffect(() => { setSelectedImageIdx(0) }, [selectedColor, selectedSize])

  const wishlisted = isWishlisted(product.id)
  const currentImage = visibleImages[selectedImageIdx] || visibleImages[0] || null

  // Variant-reactive price
  const currentVariantPrice = useMemo(() => {
    const prices = product.variants?.prices
    if (!prices?.length) return product.price
    const map = new Map<string, number>()
    for (const vp of prices) {
      map.set(`${vp.size}::${vp.color}`, vp.price)
    }
    return map.get(`${selectedSize}::${selectedColor}`)
      ?? map.get(`${selectedSize}::`)
      ?? map.get(`::${selectedColor}`)
      ?? product.price
  }, [product.variants?.prices, product.price, selectedSize, selectedColor])
  const showFromPrice = product.hasVariantPricing === true && !selectedSize && !selectedColor

  // Check if current combination is available
  const isCurrentCombinationAvailable = (() => {
    if (product.inStock === false) return false
    if (unavailableCombinations.length > 0 && selectedColor && selectedSize) {
      return !unavailableCombinations.some(
        uc => uc.color === selectedColor && uc.size === selectedSize
      )
    }
    if (selectedColor && !availableColorSet.has(selectedColor)) return false
    if (selectedSize && !availableSizeSet.has(selectedSize)) return false
    return true
  })()

  const handleAddToCart = () => {
    const variants: { size?: string; color?: string } = {}
    if (selectedSize) variants.size = selectedSize
    if (selectedColor) variants.color = selectedColor
    onAddToCart?.(quantity, Object.keys(variants).length > 0 ? variants : undefined)
  }

  return (
    <>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto detail-scroll px-5 py-4 space-y-4">
        <ProductImageGallery
          images={visibleImages}
          alt={product.title}
          selectedIndex={selectedImageIdx}
          onSelectIndex={setSelectedImageIdx}
        />

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
          {product.compareAtPrice ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm line-through text-muted-foreground">
                  {formatPrice(product.compareAtPrice, locale, product.currency)}
                </span>
                {(() => {
                  const pct = Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
                  return pct > 0 ? (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0.5">-{pct}%</Badge>
                  ) : null
                })()}
              </div>
              <span className="text-2xl font-bold text-destructive tracking-tight block">
                {formatPrice(currentVariantPrice, locale, product.currency)}
              </span>
            </div>
          ) : (
            <span className="text-2xl font-bold text-foreground tracking-tight block">
              {showFromPrice && (
                <span className="text-sm font-normal text-muted-foreground mr-1">{t('fromPrice')}</span>
              )}
              {formatPrice(currentVariantPrice, locale, product.currency)}
            </span>
          )}
        </div>

        {/* Variant Selectors */}
        {((allSizes?.length ?? 0) > 0 || (allColors?.length ?? 0) > 0) && (
          <>
            <div className="h-px bg-border/40" />
            <VariantSelector
              allSizes={allSizes}
              allColors={allColors}
              availableSizes={availableSizeSet}
              availableColors={availableColorSet}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
              onSizeChange={(s) => setSelectedSize(hasSizeMapping ? s : (s === selectedSize ? '' : s))}
              onColorChange={(c) => setSelectedColor(hasColorMapping ? c : (c === selectedColor ? '' : c))}
              sizeLabel={t('size')}
              colorLabel={t('color')}
            />
          </>
        )}

        {/* Quantity */}
        <div className="h-px bg-border/40" />
        <QuantitySelector
          quantity={quantity}
          onQuantityChange={setQuantity}
          label={t('quantity')}
        />

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

        {/* Specifications */}
        {(product.materials || product.printTechnique || product.manufacturingCountry || product.careInstructions || product.safetyInformation || product.finish) && (
          <>
            <div className="h-px bg-border/40" />
            <ProductSpecifications
              materials={product.materials}
              finish={product.finish}
              printTechnique={product.printTechnique}
              manufacturingCountry={product.manufacturingCountry}
              careInstructions={product.careInstructions}
              safetyInformation={product.safetyInformation}
              labels={{
                specifications: t('specifications'),
                materials: t('materials'),
                printTechnique: t('printTechnique'),
                madeIn: t('madeIn'),
                careInstructions: t('careInstructions'),
                safetyInformation: t('safetyInformation'),
              }}
            />
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-4 border-t border-border/40 space-y-2">
        <div className="flex gap-2">
          <Button
            className="flex-1 h-11 text-sm font-semibold"
            onClick={handleAddToCart}
            disabled={
              !isCurrentCombinationAvailable ||
              ((product.variants?.sizes?.length ?? 0) > 0 && !selectedSize) ||
              ((product.variants?.colors?.length ?? 0) > 0 && !selectedColor)
            }
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {!isCurrentCombinationAvailable ? t('outOfStock') : t('addToCart')}
          </Button>
          {product.id && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 flex-shrink-0 rounded-lg"
                asChild
              >
                <Link href={`/${locale}/design/${product.slug}`}>
                  <Paintbrush2 className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 flex-shrink-0 rounded-lg"
                onClick={() => toggleWishlist(product.id)}
              >
                <Heart className={cn('h-4 w-4', wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
              </Button>
            </>
          )}
        </div>
        {onAskAbout && (
          <Button
            variant="ghost"
            className="w-full h-10 text-sm text-muted-foreground hover:text-foreground"
            onClick={onAskAbout}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {t('askAboutProductButton')}
          </Button>
        )}
      </div>
    </>
  )
})

// ─── ArtifactContent ─────────────────────────────────────

const ArtifactContent = memo(function ArtifactContent({
  artifact,
  onAskAbout,
}: {
  artifact: { id: string; type: string; title: string; data: any }
  onAskAbout?: (question: string) => void
}) {
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const { addToCart } = useCart()

  const { product: fetchedProduct, loading: fetchLoading } = useProductDetail(
    artifact.type === 'product' ? artifact.data?.id : null,
    locale
  )

  if (artifact.type === 'product') {
    if (fetchLoading || !fetchedProduct) return <DetailPanelSkeleton />

    return (
      <ProductView
        product={fetchedProduct}
        locale={locale}
        onAddToCart={(qty, variants) => addToCart(fetchedProduct.id, qty, variants, fetchedProduct.title, fetchedProduct.price)}
        onAskAbout={onAskAbout ? () => onAskAbout(`Tell me more about ${fetchedProduct.title}`) : undefined}
      />
    )
  }

  // Design artifacts
  if (artifact.type === 'design') {
    return (
      <div className="flex-1 overflow-y-auto detail-scroll p-5 space-y-4">
        <h3 className="font-semibold text-foreground text-[15px]">{artifact.title}</h3>
        {artifact.data?.image && (
          <div className="aspect-[4/3] w-full rounded-2xl bg-muted overflow-hidden relative">
            <Image src={artifact.data.image} alt={artifact.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 40vw" />
          </div>
        )}
        {artifact.data?.prompt && (
          <p className="text-sm text-muted-foreground leading-relaxed">{artifact.data.prompt}</p>
        )}
      </div>
    )
  }

  // Other artifact types
  return (
    <div className="flex-1 overflow-y-auto detail-scroll p-5 space-y-3">
      <h3 className="font-semibold text-foreground text-[15px]">{artifact.title}</h3>
      <p className="text-xs text-muted-foreground">Type: {artifact.type}</p>
      <pre className="text-xs bg-muted/30 border border-border/40 p-3 rounded-xl overflow-auto whitespace-pre-wrap break-words">
        {JSON.stringify(artifact.data, null, 2)}
      </pre>
    </div>
  )
})
