'use client'

/**
 * StorefrontSidebar - Left sidebar with store navigation + AI recommendations
 *
 * Contains:
 * - Logo + store name (animated gradient icon)
 * - Navigation items (Discover, Trends, New Arrivals, Favorites, Orders)
 * - Recommended products section
 * - Popular today section
 * - PodClaw live status footer
 */

import { useTranslations } from 'next-intl'
import { Home, TrendingUp, Sparkles, Heart, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StorefrontSidebarProps {
  onSelectProduct: (productId: string) => void
}

export function StorefrontSidebar({ onSelectProduct }: StorefrontSidebarProps) {
  const t = useTranslations('storefront')

  const navigationItems = [
    { icon: Home, label: t('discover'), active: true },
    { icon: TrendingUp, label: t('trends') },
    { icon: Sparkles, label: t('newArrivals') },
    { icon: Heart, label: t('favorites') },
    { icon: ShoppingBag, label: t('orders') },
  ]

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Logo + Store Name */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">P</span>
          </div>
          <span className="font-semibold text-foreground">POD AI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-2">
        {navigationItems.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={index}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                item.active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Recommended Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {t('recommended')}
          </h3>
          <div className="space-y-2">
            <ProductCard
              title="Classic T-Shirt"
              price="$24.99"
              rating={4.5}
              onClick={() => onSelectProduct('mock-product-1')}
            />
            <ProductCard
              title="Vintage Hoodie"
              price="$49.99"
              rating={4.8}
              onClick={() => onSelectProduct('mock-product-2')}
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {t('popularToday')}
          </h3>
          <div className="space-y-2">
            <ProductCard
              title="Minimalist Poster"
              price="$19.99"
              rating={4.7}
              onClick={() => onSelectProduct('mock-product-3')}
            />
          </div>
        </div>
      </div>

      {/* PodClaw Status Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>{t('lastDesignGenerated')}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * ProductCard - Compact product card for sidebar recommendations
 */
function ProductCard({
  title,
  price,
  rating,
  onClick,
}: {
  title: string
  price: string
  rating: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition-colors text-left"
    >
      {/* Thumbnail placeholder */}
      <div className="w-11 h-11 rounded-md bg-muted flex-shrink-0" />

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-medium text-foreground">{price}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">★</span>
            <span className="text-xs text-muted-foreground">{rating}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
