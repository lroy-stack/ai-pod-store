'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MessageSquare, Store, ShoppingCart, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'

const NAV_ITEMS = [
  { href: '/chat',    icon: MessageSquare, tKey: 'chat'    },
  { href: '/shop',    icon: Store,         tKey: 'shop'    },
  { href: '/cart',    icon: ShoppingCart,  tKey: 'cart'    },
  { href: '/profile', icon: User,          tKey: 'profile' },
] as const

export function BottomNav() {
  const t = useTranslations('navigation')
  const pathname = usePathname()
  const params = useParams()
  const locale = params.locale as string
  const { items } = useCart()
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border/50"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around px-1">
        {NAV_ITEMS.map(({ href, icon: Icon, tKey }) => {
          const fullHref = `/${locale}${href}`
          const isActive =
            pathname === fullHref || pathname.startsWith(`${fullHref}/`)
          const isCart = tKey === 'cart'

          return (
            <Link
              key={href}
              href={fullHref}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 py-2 flex-1 min-h-[56px] transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {/* Active indicator line at top */}
              <span
                className={cn(
                  'absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-300',
                  isActive ? 'w-8 bg-primary opacity-100' : 'w-0 opacity-0'
                )}
                aria-hidden="true"
              />

              {/* Icon wrapper — pill background when active */}
              <span
                className={cn(
                  'relative flex items-center justify-center w-11 h-7 rounded-2xl transition-all duration-200',
                  isActive ? 'bg-primary/10' : 'bg-transparent'
                )}
              >
                <Icon
                  className={cn(
                    'size-[19px] transition-all duration-200',
                    isActive ? 'text-primary scale-110' : 'text-muted-foreground'
                  )}
                  aria-hidden="true"
                />

                {/* Cart badge */}
                {isCart && cartCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-0.5 leading-none"
                    aria-label={`${cartCount} items in cart`}
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </span>

              {/* Label */}
              <span
                className={cn(
                  'text-[10px] leading-none font-medium transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {t(tKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
