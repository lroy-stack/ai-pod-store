'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Star, Heart, ShoppingCart, ImageOff, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { useWishlist } from '@/hooks/useWishlist'
import { useCart } from '@/hooks/useCart'
import { QuickViewModal } from './QuickViewModal'

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
    e.stopPropagation()
    setShowQuickView(true)
  }

  const localizedPrice = getLocalizedPrice(product.price, product.currency, locale)
  const formattedPrice = formatPrice(localizedPrice, locale)

  return (
    <>
      <Link
        href={`/shop/${product.id}`}
        className="group block rounded-2xl bg-card overflow-hidden border border-border/40 hover:border-border/80 shadow-sm hover:shadow-xl transition-all duration-300"
      >
        {/* Image */}
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

          {/* Wishlist heart — always visible */}
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
        </div>

        {/* Info + Actions */}
        <div className="px-3.5 py-3 space-y-2">
          <div className="space-y-0.5">
            <h3 className="font-medium text-sm leading-snug line-clamp-1 text-foreground group-hover:text-primary transition-colors">
              {product.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {product.description}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground tracking-tight">
              {formattedPrice}
            </p>
            {product.rating && product.rating > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star className="h-3 w-3 fill-rating text-rating" />
                <span>{product.rating.toFixed(1)}</span>
                {product.reviewCount ? <span>({product.reviewCount})</span> : null}
              </div>
            )}
          </div>

          {/* Action buttons — always visible, touch-friendly */}
          <div className="flex gap-1.5 pt-0.5">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs font-medium rounded-lg"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              {t('addToCart')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg flex-shrink-0"
              onClick={handleQuickView}
              title={t('quickView')}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
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
