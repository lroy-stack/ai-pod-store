'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { MessageSquare, Store, ShoppingCart, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'

const NAV_ITEMS = [
  { href: '/chat', icon: MessageSquare, labelKey: 'Chat' },
  { href: '/shop', icon: Store, labelKey: 'Shop' },
  { href: '/cart', icon: ShoppingCart, labelKey: 'Cart' },
  { href: '/profile', icon: User, labelKey: 'Profile' },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const params = useParams()
  const locale = params.locale as string
  const { items } = useCart()
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
          const fullHref = `/${locale}${href}`
          const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`)

          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                'flex flex-col items-center justify-center gap-1 p-3 min-h-[56px] min-w-[64px] transition-colors relative',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" />
              {labelKey === 'Cart' && cartCount > 0 && (
                <span className="absolute top-2 right-2 size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
              <span className="text-[11px] leading-none">{labelKey}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
