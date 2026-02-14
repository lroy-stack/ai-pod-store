'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Star, Heart, ShoppingCart, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { useWishlist } from '@/hooks/useWishlist'
import { useCart } from '@/hooks/useCart'
import { QuickViewModal, QuickViewButton } from './QuickViewModal'

interface Product {
  id: string
  title: string
  description: string
  price: number
  currency: string
  image: string
  rating?: number
  reviewCount?: number
  category?: string
  variants?: {
    sizes?: string[]
    colors?: string[]
  }
  stock?: number
}

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations('product')
  const locale = useLocale()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const { addToCart } = useCart()
  const [showQuickView, setShowQuickView] = useState(false)
  const [imgError, setImgError] = useState(false)
  const wishlisted = isWishlisted(product.id)

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleWishlist(product.id)
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addToCart(product.id, 1, undefined, product.title, product.price)
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowQuickView(true)
  }

  // Convert price to locale's currency and format it
  const localizedPrice = getLocalizedPrice(product.price, product.currency, locale)
  const formattedPrice = formatPrice(localizedPrice, locale)

  return (
    <>
      <Link
        href={`/shop/${product.id}`}
        className="group block rounded-2xl bg-card overflow-hidden border border-border/40 hover:border-border/80 shadow-sm hover:shadow-xl transition-all duration-300"
      >
        {/* Image — edge-to-edge, square */}
        <div className="relative aspect-square bg-muted overflow-hidden">
          {product.image && !imgError ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
              <ImageOff className="h-10 w-10" />
              <span className="text-xs font-medium text-muted-foreground/60">{product.title}</span>
            </div>
          )}

          {/* Gradient overlay — hover for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Category — frosted glass pill */}
          {product.category && (
            <span className="absolute top-2.5 left-2.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-background/70 text-foreground/80 backdrop-blur-md border border-border/30">
              {product.category}
            </span>
          )}

          {/* Wishlist heart — top right, frosted */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm hover:bg-card/90"
            onClick={handleToggleWishlist}
            aria-label={wishlisted ? t('removeFromWishlist') : t('addToWishlist')}
          >
            <Heart
              className={cn(
                'h-4 w-4',
                wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground'
              )}
            />
          </Button>

          {/* Quick View — center bottom on hover */}
          <QuickViewButton onClick={handleQuickView} />

          {/* Cart button — reveals on hover, bottom right */}
          <Button
            size="icon"
            className="absolute bottom-2.5 right-2.5 h-9 w-9 rounded-full shadow-lg bg-primary text-primary-foreground opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
            onClick={handleAddToCart}
            title={t('addToCart')}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>

        {/* Info — clean, minimal */}
        <div className="px-3.5 py-3 space-y-1">
          <h3 className="font-medium text-sm leading-snug line-clamp-1 text-foreground group-hover:text-primary transition-colors">
            {product.title}
          </h3>

          <p className="text-xs text-muted-foreground line-clamp-1">
            {product.description}
          </p>

          <div className="flex items-center justify-between pt-1">
            <p className="text-sm font-semibold text-foreground tracking-tight">
              {formattedPrice}
            </p>

            {product.rating && product.rating > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star className="h-3 w-3 fill-rating text-rating" />
                <span>{product.rating.toFixed(1)}</span>
                {product.reviewCount ? (
                  <span>({product.reviewCount})</span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </Link>

      <QuickViewModal
        product={product}
        open={showQuickView}
        onOpenChange={setShowQuickView}
      />
    </>
  )
}
