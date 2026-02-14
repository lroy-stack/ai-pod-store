'use client'

/**
 * StorefrontSidebar - Left sidebar with store navigation + AI recommendations
 *
 * Contains:
 * - Logo + store name
 * - Navigation items as real Links with active state
 * - Cart link with badge
 * - Recommended products section (fetched from Supabase via API)
 * - PodClaw live status footer
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Home, Store, Sparkles, Heart, ShoppingBag, ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'
import { useStorefront } from './StorefrontContext'
import { formatPrice } from '@/lib/currency'

interface SidebarProduct {
  id: string
  title: string
  price: number
  currency: string
  rating: number
  image: string | null
}

interface StorefrontSidebarProps {
  onNavigate?: () => void
}

export function StorefrontSidebar({ onNavigate }: StorefrontSidebarProps) {
  const t = useTranslations('storefront')
  const { itemCount } = useCart()
  const { setSelectedProduct, addArtifact } = useStorefront()
  const params = useParams()
  const pathname = usePathname()
  const locale = params.locale as string
  const [recommended, setRecommended] = useState<SidebarProduct[]>([])
  const [popular, setPopular] = useState<SidebarProduct[]>([])

  useEffect(() => {
    async function fetchSidebarProducts() {
      try {
        // Fetch top-rated for recommended
        const recRes = await fetch('/api/products?limit=3&sort=topRated')
        const recData = await recRes.json()
        if (recData.success && recData.items) {
          const recItems = recData.items.slice(0, 2)
          setRecommended(recItems)

          // Fetch popular, excluding recommended IDs to avoid duplicates
          const excludeIds = new Set(recItems.map((p: SidebarProduct) => p.id))
          const popRes = await fetch('/api/products?limit=3&sort=popular')
          const popData = await popRes.json()
          if (popData.success && popData.items) {
            const filtered = popData.items.filter((p: SidebarProduct) => !excludeIds.has(p.id))
            setPopular(filtered.slice(0, 1))
          }
        }
      } catch (error) {
        console.error('Error fetching sidebar products:', error)
      }
    }
    fetchSidebarProducts()
  }, [])

  const navigationItems = [
    { icon: Home, label: t('discover'), href: `/${locale}` },
    { icon: Store, label: t('shop') ?? 'Shop', href: `/${locale}/shop` },
    { icon: Sparkles, label: t('newArrivals'), href: `/${locale}/shop?sort=newest` },
    { icon: Heart, label: t('favorites'), href: `/${locale}/wishlist` },
    { icon: ShoppingBag, label: t('orders'), href: `/${locale}/orders` },
  ]

  const isActive = (href: string) => {
    // Exact match for home
    if (href === `/${locale}`) return pathname === `/${locale}` || pathname === `/${locale}/`
    // Strip query params for comparison
    const basePath = href.split('?')[0]
    return pathname.startsWith(basePath)
  }

  const handleProductClick = (productId: string, productData?: SidebarProduct) => {
    // Backward compatibility - set selectedProduct
    setSelectedProduct(productId)

    // Add to artifact system for tabs
    if (productData) {
      addArtifact({
        id: productId,
        type: 'product',
        title: productData.title || `Product ${productId}`,
        data: productData,
      })
    } else {
      // If no product data, create placeholder
      addArtifact({
        id: productId,
        type: 'product',
        title: `Product ${productId}`,
        data: { id: productId },
      })
    }

    onNavigate?.()
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Logo + Store Name */}
      <div className="p-4 border-b border-border">
        <Link href={`/${locale}`} className="flex items-center gap-3" onClick={onNavigate}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">P</span>
          </div>
          <span className="font-semibold text-foreground">POD AI</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-2">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* Cart with badge */}
        <Link
          href={`/${locale}/cart`}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
            isActive(`/${locale}/cart`)
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>{t('cart') ?? 'Cart'}</span>
          {itemCount > 0 && (
            <Badge
              variant="destructive"
              className="ml-auto h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {itemCount}
            </Badge>
          )}
        </Link>
      </nav>

      {/* Recommended Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {t('recommended')}
          </h3>
          <div className="space-y-2">
            {recommended.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                price={formatPrice(product.price, locale, product.currency)}
                rating={product.rating}
                image={product.image}
                onClick={() => handleProductClick(product.id, product)}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {t('popularToday')}
          </h3>
          <div className="space-y-2">
            {popular.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                price={formatPrice(product.price, locale, product.currency)}
                rating={product.rating}
                image={product.image}
                onClick={() => handleProductClick(product.id, product)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* PodClaw Status Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span>{t('lastDesignGenerated')}</span>
        </div>
      </div>
    </div>
  )
}

function ProductCard({
  title,
  price,
  rating,
  image,
  onClick,
}: {
  title: string
  price: string
  rating: number
  image?: string | null
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="flex items-center gap-3 w-full p-2 h-auto rounded-lg hover:bg-muted transition-colors justify-start"
    >
      {image ? (
        <img src={image} alt={title} className="w-11 h-11 rounded-md object-cover flex-shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-md bg-muted flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-medium text-foreground">{price}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">&#9733;</span>
            <span className="text-xs text-muted-foreground">{rating}</span>
          </div>
        </div>
      </div>
    </Button>
  )
}
