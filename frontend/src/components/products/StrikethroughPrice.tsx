import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/currency'

interface StrikethroughPriceProps {
  price: number
  compareAtPrice: number
  locale: string
  currency?: string
  compact?: boolean
}

export function StrikethroughPrice({ price, compareAtPrice, locale, currency, compact }: StrikethroughPriceProps) {
  const pct = Math.round(((compareAtPrice - price) / compareAtPrice) * 100)

  return (
    <span className={`inline-flex items-center flex-wrap ${compact ? 'gap-1' : 'gap-2 md:gap-3'}`}>
      <span className={`line-through text-muted-foreground ${compact ? 'text-xs' : 'text-lg md:text-xl'}`}>
        {formatPrice(compareAtPrice, locale, currency)}
      </span>
      <span className={`font-bold text-destructive ${compact ? 'text-sm' : 'text-2xl md:text-3xl'}`}>
        {formatPrice(price, locale, currency)}
      </span>
      {pct > 0 && !compact && (
        <Badge variant="destructive" className="text-sm md:text-base px-2 py-0.5 md:px-2.5">
          -{pct}%
        </Badge>
      )}
    </span>
  )
}
