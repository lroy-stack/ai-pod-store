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
import { useAuth } from '@/hooks/useAuth'
import { useChatHistory } from '@/components/chat/ChatHistoryContext'
// ChatHistoryList moved to inline chat layout (not sidebar)
import Image from 'next/image'
import { BrandMark } from '@/components/ui/brand-mark'
import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Store, Star, Heart, ShoppingBag, ShoppingCart, PanelLeftClose, MessageCircle, History, SquarePen,
} from 'lucide-react'
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
  compareAtPrice?: number
  currency: string
  rating: number
  image: string | null
}

interface StorefrontSidebarProps {
  onNavigate?: () => void
  onCollapse?: () => void
}

export function StorefrontSidebar({ onNavigate, onCollapse }: StorefrontSidebarProps) {
  const t = useTranslations('storefront')
  const { itemCount } = useCart()
  const { authenticated } = useAuth()
  const { onNewChat, setViewMode } = useChatHistory()
  const { setSelectedProduct, addArtifact } = useStorefront()
  const params = useParams()
  const pathname = usePathname()
  const currentSearchParams = useSearchParams()
  const locale = params.locale as string
  const [recommended, setRecommended] = useState<SidebarProduct[]>([])
  const [popular, setPopular] = useState<SidebarProduct[]>([])
  // Recommended: fetch top 6 by rating, shuffle, pick 2 — re-fetch every 5 min
  useEffect(() => {
    async function fetchRecommended() {
      try {
        const res = await fetch('/api/products?limit=6&sort=topRated')
        const data = await res.json()
        if (data.success && data.items) {
          const shuffled = [...data.items].sort(() => Math.random() - 0.5)
          setRecommended(shuffled.slice(0, 2))
        }
      } catch (e) {
        console.error('Sidebar recommended fetch error:', e)
      }
    }
    fetchRecommended()
    const interval = setInterval(fetchRecommended, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Popular Today: fetch top 4 by review_count, pick 1 using day-of-year as seed
  useEffect(() => {
    async function fetchPopular() {
      try {
        const res = await fetch('/api/products?limit=4&sort=popular')
        const data = await res.json()
        if (data.success && data.items?.length > 0) {
          const dayOfYear = Math.floor(
            (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
          )
          const index = dayOfYear % data.items.length
          setPopular([data.items[index]])
        }
      } catch (e) {
        console.error('Sidebar popular fetch error:', e)
      }
    }
    fetchPopular()
  }, [])

  const tNav = useTranslations('navigation')

  const navigationItems = [
    { icon: MessageCircle, label: tNav('chat') || 'Chat', href: `/${locale}/chat` },
    { icon: Store, label: t('shop') ?? 'Shop', href: `/${locale}/shop` },
    { icon: Star, label: t('newArrivals'), href: `/${locale}/shop?sort=newest&newArrivals=true` },
    { icon: Heart, label: t('favorites'), href: `/${locale}/wishlist` },
    { icon: ShoppingBag, label: t('orders'), href: `/${locale}/orders` },
  ]

  const isActive = (href: string) => {
    // Exact match for chat
    if (href === `/${locale}/chat`) return pathname === `/${locale}/chat` || pathname === `/${locale}/chat/`
    // If href has query params, require full match (path + all specified params)
    if (href.includes('?')) {
      const url = new URL(href, 'http://x')
      if (pathname !== url.pathname) return false
      const hrefParams = new URLSearchParams(url.search)
      for (const [key, val] of hrefParams) {
        if (currentSearchParams.get(key) !== val) return false
      }
      return true
    }
    // Plain path: exact match only
    return pathname === href || pathname === `${href}/`
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
      <div className="px-4 h-14 border-b border-border flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-3" onClick={onNavigate}>
          <BrandMark showName size={24} nameHeight={11} />
        </Link>
        {onCollapse && (
          <Button variant="ghost" size="icon" className="h-7 w-7 hidden lg:inline-flex" onClick={onCollapse}>
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t('collapseSidebar') ?? 'Collapse sidebar'}</span>
          </Button>
        )}
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
              <Icon className="h-4 w-4" aria-hidden="true" />
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
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
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

      {/* Chat actions — labeled CTAs, auth only */}
      {authenticated && onNewChat && (
        <div className="px-3 py-2 border-t border-border/50 space-y-0.5">
          <button
            onClick={() => { onNewChat(); setViewMode('chat'); onNavigate?.() }}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            <span>{t('newChat')}</span>
          </button>
          <Link
            href={`/${locale}/chat`}
            onClick={() => { setViewMode('history'); onNavigate?.() }}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <History className="h-4 w-4 shrink-0" />
            <span>{t('chatHistory')}</span>
          </Link>
        </div>
      )}

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
                originalPrice={product.compareAtPrice ? formatPrice(product.compareAtPrice, locale, product.currency) : undefined}
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
                originalPrice={product.compareAtPrice ? formatPrice(product.compareAtPrice, locale, product.currency) : undefined}
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
          <span>{t('podclawActive') ?? 'AI Store Manager Active'}</span>
        </div>
      </div>
    </div>
  )
}

function ProductCard({
  title,
  price,
  originalPrice,
  rating,
  image,
  onClick,
}: {
  title: string
  price: string
  originalPrice?: string
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
        <div className="relative w-11 h-11 rounded-md overflow-hidden flex-shrink-0 bg-muted">
          <Image src={image} alt={title} fill className="object-cover" sizes="44px" />
        </div>
      ) : (
        <div className="w-11 h-11 rounded-md bg-muted flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {originalPrice ? (
            <>
              <span className="text-[11px] line-through text-muted-foreground">{originalPrice}</span>
              <span className="text-xs font-medium text-destructive">{price}</span>
            </>
          ) : (
            <span className="text-xs font-medium text-foreground">{price}</span>
          )}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">&#9733;</span>
            <span className="text-xs text-muted-foreground">{rating}</span>
          </div>
        </div>
      </div>
    </Button>
  )
}
