'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Star, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'
import { Button } from '@/components/ui/button'

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
}

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations('product')
  const locale = useLocale()
  const [isWishlisted, setIsWishlisted] = useState(false)

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsWishlisted(!isWishlisted)
  }

  // Convert price to locale's currency and format it
  const localizedPrice = getLocalizedPrice(product.price, product.currency, locale)
  const formattedPrice = formatPrice(localizedPrice, locale)

  const renderStars = (rating: number = 0) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'size-4',
              star <= Math.round(rating)
                ? 'fill-rating text-rating'
                : 'text-muted-foreground/50'
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <Link
      href={`/shop/${product.id}`}
      className="group block rounded-lg border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="relative aspect-square bg-muted">
        <Image
          src={product.image}
          alt={product.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 bg-card/90 hover:bg-card"
          onClick={toggleWishlist}
          aria-label={isWishlisted ? t('removeFromWishlist') : t('addToWishlist')}
        >
          <Heart
            className={cn(
              'size-5',
              isWishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground'
            )}
          />
        </Button>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1 line-clamp-1 group-hover:text-primary transition-colors">
          {product.title}
        </h3>

        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {product.description}
        </p>

        <div className="flex items-center justify-between">
          <p className="text-xl font-bold">
            {formattedPrice}
          </p>

          {product.rating && (
            <div className="flex flex-col items-end">
              {renderStars(product.rating)}
              {product.reviewCount && (
                <p className="text-xs text-muted-foreground mt-1">
                  ({product.reviewCount})
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
