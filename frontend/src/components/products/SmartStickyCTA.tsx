'use client'

import { useEffect, useState, type RefObject } from 'react'
import { ShoppingCart, Minus, Plus, Zap } from 'lucide-react'
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
  compareAtPrice?: number
  price?: number
  locale?: string
  currency?: string
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
  quantity,
  onQuantityChange,
}: SmartStickyCTAProps) {
  const t = useTranslations('product')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [targetRef])

  if (!visible) return null

  const hasQuantity = quantity != null && onQuantityChange

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden">
      {/* Glass bar */}
      <div className="bg-card/95 backdrop-blur-md border-t border-border/60 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-3 py-2">
        <div className="flex items-center gap-2 max-w-lg mx-auto">

          {/* Price block */}
          <div className="shrink-0 min-w-[64px]">
            {compareAtPrice && price && locale && currency ? (
              <StrikethroughPrice
                price={price}
                compareAtPrice={compareAtPrice}
                locale={locale}
                currency={currency}
                compact
              />
            ) : (
              <span className="text-base font-bold text-foreground tabular-nums">
                {formattedPrice}
              </span>
            )}
          </div>

          {/* Quantity stepper */}
          {hasQuantity && (
            <div className="flex items-center rounded-lg border border-border bg-muted/50 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-l-lg rounded-r-none hover:bg-muted"
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="text-sm font-semibold w-7 text-center text-foreground select-none">
                {quantity}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-r-lg rounded-l-none hover:bg-muted"
                onClick={() => onQuantityChange(quantity + 1)}
                disabled={quantity >= 10}
                aria-label="Increase quantity"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          )}

          {/* CTAs */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {onBuyNow && (
              <Button
                className="flex-1 min-w-0 gap-1.5 font-semibold"
                size="default"
                disabled={disabled || isAdding}
                onClick={onBuyNow}
                aria-label={disabled ? t('outOfStock') : t('buyNow')}
              >
                <Zap className="size-4 shrink-0" />
                <span className="hidden sm:inline truncate">
                  {disabled ? t('outOfStock') : t('buyNow')}
                </span>
              </Button>
            )}
            <Button
              className={cn('min-w-0 gap-1.5', onBuyNow ? 'shrink-0 px-3' : 'flex-1 font-semibold')}
              variant={onBuyNow ? 'outline' : 'default'}
              size="default"
              disabled={disabled || isAdding}
              onClick={onAddToCart}
              aria-label={t('addToCart')}
            >
              <ShoppingCart className={cn('size-4 shrink-0', isAdding && 'animate-bounce')} />
              {!onBuyNow && (
                <span className="hidden sm:inline truncate">
                  {disabled ? t('outOfStock') : isAdding ? t('adding') : t('addToCart')}
                </span>
              )}
            </Button>
          </div>

        </div>
      </div>
    </div>
  )
}
