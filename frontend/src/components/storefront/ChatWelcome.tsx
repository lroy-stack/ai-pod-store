'use client'

/**
 * ChatWelcome — Minimal welcome screen (brand + greeting)
 *
 * Mobile-first: clean centered layout like ChatGPT/Claude.
 * Prompt suggestions moved to ChatInputBar as horizontal scrollable chips.
 * Orders/favorites shown as compact inline cards for returning users.
 */

import { useTranslations } from 'next-intl'
import { Package, Heart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BrandMark } from '@/components/ui/brand-mark'

interface ChatWelcomeProps {
  userName?: string
  activeOrders?: Array<{ id: string; status: string; total: number }> | null
  recentFavorites?: Array<{ id: string; name: string; price: number; image?: string | null }> | null
}

export function ChatWelcome({
  userName,
  activeOrders,
  recentFavorites,
}: ChatWelcomeProps) {
  const t = useTranslations('storefront')

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] md:min-h-[50vh]">
      <div className="text-center space-y-4 md:space-y-6 w-full max-w-lg mx-auto px-2">
        <BrandMark size={40} showName nameHeight={20} className="justify-center gap-2.5" />

        <div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight text-foreground mb-1">
            {userName
              ? t('welcomeBackTitle', { name: userName.split(' ')[0] || 'there' })
              : t('welcomeSubtitle')}
          </h1>
          {userName && (
            <p className="text-sm text-muted-foreground">
              {t('welcomeBackSubtitle')}
            </p>
          )}
        </div>

        {/* Compact inline cards for returning users */}
        {userName && (activeOrders || recentFavorites) && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {activeOrders && activeOrders.length > 0 && (
              <div className="flex-1 rounded-xl border border-border/50 bg-card/60 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{t('activeOrders')}</span>
                </div>
                <div className="space-y-1">
                  {activeOrders.slice(0, 2).map((order) => (
                    <div key={order.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">#{order.id.slice(0, 8)}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {order.status}
                        </Badge>
                        <span className="font-medium">€{order.total.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentFavorites && recentFavorites.length > 0 && (
              <div className="flex-1 rounded-xl border border-border/50 bg-card/60 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Heart className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{t('recentFavorites')}</span>
                </div>
                <div className="space-y-1">
                  {recentFavorites.slice(0, 2).map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs">
                      {item.image && (
                        <img src={item.image} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                      )}
                      <span className="text-foreground truncate flex-1">{item.name}</span>
                      <span className="font-medium shrink-0">€{item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
