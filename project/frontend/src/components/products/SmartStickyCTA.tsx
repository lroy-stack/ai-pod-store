'use client'

import { useEffect, useState, type RefObject } from 'react'
import { ShoppingCart, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { StrikethroughPrice } from '@/components/products/StrikethroughPrice'
import { cn } from '@/lib/utils'

interface SmartStickyCTAProps {
  targetRef: RefObject<HTMLDivElement | null>
  formattedPrice: string
  onAddToCart: () => void
  onBuyNow?: () => void
  disabled: boolean
  isAdding: boolean
  // Enhanced props (Feature 132)
  compareAtPrice?: number
  price?: number
  locale?: string
  currency?: string
  colors?: string[]
  selectedColor?: string
  onColorChange?: (color: string) => void
  quantity?: number
  onQuantityChange?: (qty: number) => void
}

export function SmartStickyCTA({
  targetRef,
  formattedPrice,
  onAddToCart,
  onBuyNow,
  disabled,
  isAdding,
  compareAtPrice,
  price,
  locale,
  currency,
  colors,
  selectedColor,
  onColorChange,
  quantity,
  onQuantityChange,
}: SmartStickyCTAProps) {
  const t = useTranslations('product')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = targetRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar when main CTA scrolls out of viewport
        setVisible(!entry.isIntersecting)
      },
      { threshold: 0 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [targetRef])

  if (!visible) return null

  const hasColors = colors && colors.length > 1 && onColorChange
  const hasQuantity = quantity != null && onQuantityChange

  return (
    <div className="fixed bottom-[60px] inset-x-0 z-40 md:hidden border-t border-border bg-card px-3 py-2.5 shadow-lg">
      <div className="flex items-center gap-2 max-w-lg mx-auto">
        {/* Price */}
        <div className="shrink-0">
          {compareAtPrice && price && locale && currency ? (
            <StrikethroughPrice
              price={price}
              compareAtPrice={compareAtPrice}
              locale={locale}
              currency={currency}
              compact
            />
          ) : (
            <span className="text-base font-bold text-foreground">
              {formattedPrice}
            </span>
          )}
        </div>

        {/* Mini color dots */}
        {hasColors && (
          <div className="flex items-center gap-1 shrink-0">
            {colors.slice(0, 5).map((color) => (
              <button
                key={color}
                className={cn(
                  'flex items-center justify-center min-w-[44px] min-h-[44px] p-1.5',
                )}
                onClick={() => onColorChange(color)}
                aria-label={color}
                title={color}
              >
                <span
                  className={cn(
                    'size-6 rounded-full border-2 transition-all block',
                    selectedColor === color
                      ? 'border-primary scale-110'
                      : 'border-border'
                  )}
                />
              </button>
            ))}
          </div>
        )}

        {/* Quantity +/- */}
        {hasQuantity && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="size-3" />
            </Button>
            <span className="text-sm font-medium w-5 text-center text-foreground">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() => onQuantityChange(quantity + 1)}
              disabled={quantity >= 10}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        )}

        {/* Buy Now + Add to Cart */}
        {onBuyNow && (
          <Button
            className="flex-1 min-w-0"
            size="default"
            disabled={disabled || isAdding}
            onClick={onBuyNow}
          >
            <span className="truncate">
              {disabled ? t('outOfStock') : isAdding ? t('adding') : t('buyNow')}
            </span>
          </Button>
        )}
        <Button
          className={cn('min-w-0', onBuyNow ? 'shrink-0' : 'flex-1')}
          variant={onBuyNow ? 'outline' : 'default'}
          size="default"
          disabled={disabled || isAdding}
          onClick={onAddToCart}
        >
          <ShoppingCart className="size-4 mr-1.5 shrink-0" />
          {!onBuyNow && (
            <span className="truncate">
              {disabled ? t('outOfStock') : isAdding ? t('adding') : t('addToCart')}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
