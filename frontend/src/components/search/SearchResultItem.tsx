import Image from 'next/image'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProductCard } from '@/types/product'

interface SearchResultItemProps {
  product: ProductCard
  highlighted: boolean
  locale: string
  onClick: () => void
}

const localeMap: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
}

export function SearchResultItem({ product, highlighted, locale, onClick }: SearchResultItemProps) {
  const fmt = new Intl.NumberFormat(localeMap[locale] ?? 'en-US', {
    style: 'currency',
    currency: product.currency || 'EUR',
    maximumFractionDigits: 2,
  })

  const price = fmt.format(product.price)
  const compareAtPrice = product.compareAtPrice ? fmt.format(product.compareAtPrice) : null

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep focus in input
      onClick={onClick}
      className={cn(
        'group w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        highlighted ? 'bg-accent' : 'hover:bg-accent/50'
      )}
      tabIndex={-1}
    >
      {/* Thumbnail */}
      <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-muted border border-border/50">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="48px"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <Package className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground line-clamp-1 leading-snug">
          {product.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
          {product.category && <span>{product.category}</span>}
          {product.category && product.inStock === false && <span>·</span>}
          {product.inStock === false && <span>Out of stock</span>}
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-foreground">{price}</p>
        {compareAtPrice && (
          <p className="text-xs text-muted-foreground line-through">{compareAtPrice}</p>
        )}
      </div>
    </button>
  )
}
