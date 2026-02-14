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

import { useState } from 'react'
import { Star, ShoppingCart, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  onSelectProduct: (productId: string, productData?: Product) => void
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
      className={`grid gap-3 ${
        variant === 'inline'
          ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      }`}
    >
      {displayProducts.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          locale={locale}
          t={t}
          onSelect={() => onSelectProduct(product.id, product)}
          onAddToCart={() => addToCart(product.id, 1, undefined, product.title, product.price)}
        />
      ))}
    </div>
  )
}

function ProductCard({
  product,
  locale,
  t,
  onSelect,
  onAddToCart,
}: {
  product: Product
  locale: string
  t: ReturnType<typeof useTranslations>
  onSelect: () => void
  onAddToCart: () => void
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className="group relative rounded-2xl bg-card overflow-hidden border border-border/40 hover:border-border/80 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
      onClick={onSelect}
    >
      {/* Image — edge-to-edge, no gap */}
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {product.image && !imgError ? (
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
            <ImageOff className="h-10 w-10" />
            <span className="text-xs font-medium text-muted-foreground/60">{t('noImage')}</span>
          </div>
        )}

        {/* Gradient overlay — visible on hover for cart button contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Category — frosted glass pill */}
        {product.category && (
          <span className="absolute top-2.5 left-2.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-background/70 text-foreground/80 backdrop-blur-md border border-border/30">
            {product.category}
          </span>
        )}

        {/* Cart button — reveals on hover, slides up */}
        <Button
          size="icon"
          className="absolute bottom-2.5 right-2.5 h-9 w-9 rounded-full shadow-lg bg-primary text-primary-foreground opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onAddToCart()
          }}
          title={t('addToCart')}
        >
          <ShoppingCart className="h-4 w-4" />
        </Button>
      </div>

      {/* Info — clean, minimal */}
      <div className="px-3.5 py-3 space-y-0.5">
        <h3 className="font-medium text-[13px] leading-snug line-clamp-1 text-foreground">
          {product.title}
        </h3>
        <div className="flex items-center justify-between pt-0.5">
          <p className="text-sm font-semibold text-foreground tracking-tight">
            {formatPrice(product.price, locale, product.currency)}
          </p>
          {product.rating > 0 && (
            <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>{product.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
