'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, Bell, ShoppingCart, User, LogOut, Menu, Globe, PanelLeftOpen, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SearchBox } from '@/components/search/SearchBox'

interface StorefrontHeaderProps {
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
  onToggleDesktopSidebar?: () => void
}

const localeNames: Record<string, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
}

const localeFlags: Record<string, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  de: '🇩🇪',
}

export function StorefrontHeader({ onToggleSidebar, isSidebarCollapsed, onToggleDesktopSidebar }: StorefrontHeaderProps) {
  const t = useTranslations('storefront')
  const tNav = useTranslations('navigation')
  const { authenticated, user, loading, logout } = useAuth()
  const { itemCount } = useCart()
  const { unreadCount } = useNotifications()
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const locale = params.locale as string

  const [planInfo, setPlanInfo] = useState<{ tier: string; credits: number } | null>(null)

  // Fetch plan info for authenticated users
  useEffect(() => {
    if (!authenticated) {
      setPlanInfo(null)
      return
    }
    fetch('/api/subscription/usage', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setPlanInfo({ tier: data.tier || 'free', credits: data.credit_balance || 0 })
      })
      .catch(() => {})
  }, [authenticated])

  const handleLogout = async () => {
    await logout()
    router.push(`/${locale}/auth/login`)
  }

  const handleLocaleChange = (newLocale: string) => {
    // Replace the locale in the current pathname
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPathname)
  }

  const userInitial = user?.name
    ? user.name[0].toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : '?'

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isShopPage = mounted && pathname.includes('/shop')
  const isChatPage = mounted && (pathname === `/${locale}/chat` || pathname === `/${locale}/chat/`)

  return (
    <>
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 h-14 border-b border-border/50 bg-card/80 backdrop-blur-lg">
      {/* Left: Mobile toggle + Logo + Nav links */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Mobile sidebar toggle */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onToggleSidebar}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        )}

        {/* Expand sidebar button (visible when sidebar is collapsed on desktop) */}
        {isSidebarCollapsed && onToggleDesktopSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={onToggleDesktopSidebar}
          >
            <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Expand sidebar</span>
          </Button>
        )}

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              'text-muted-foreground hover:bg-muted hover:text-foreground',
              isChatPage && 'text-foreground bg-muted'
            )}
          >
            <Link href={`/${locale}/chat`}>{tNav('chat') || 'Chat'}</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              'text-muted-foreground hover:bg-muted hover:text-foreground',
              isShopPage && 'text-foreground bg-muted'
            )}
          >
            <Link href={`/${locale}/shop`}>{tNav('shop') || 'Shop'}</Link>
          </Button>
        </nav>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md hidden lg:block">
        <SearchBox
          locale={locale}
          inputClassName="rounded-full bg-muted border-0"
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Mobile Search Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
          <span className="sr-only">{t('searchPlaceholder')}</span>
        </Button>

        {/* Notifications — only for authenticated users */}
        {authenticated && (
          <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex">
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                aria-live="polite"
                aria-atomic="true"
              >
                {unreadCount}
              </Badge>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        )}

        {/* Cart */}
        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link href={`/${locale}/cart`}>
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            {itemCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                aria-live="polite"
                aria-atomic="true"
              >
                {itemCount}
              </Badge>
            )}
            <span className="sr-only">{tNav('cart')}</span>
          </Link>
        </Button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Locale Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="inline-flex">
              <Globe className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Change language</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Language</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(localeNames).map(([code, name]) => (
              <DropdownMenuItem
                key={code}
                onClick={() => handleLocaleChange(code)}
                className={cn(locale === code && 'bg-muted')}
              >
                <span className="mr-2">{localeFlags[code]}</span>
                {name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Avatar / Auth */}
        {loading ? (
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        ) : authenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  {user.avatar_url && (
                    <AvatarImage src={user.avatar_url} alt={user.name || 'Avatar'} />
                  )}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                  {planInfo && (
                    <Badge variant={planInfo.tier === 'premium' ? 'default' : 'outline'} className="text-[10px] shrink-0">
                      {planInfo.tier === 'premium' ? 'Premium' : 'Free'}
                    </Badge>
                  )}
                </div>
                {user.name && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
                {planInfo && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {planInfo.credits} credits
                  </p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/profile`}>
                  <User className="size-4" aria-hidden="true" />
                  {tNav('profile') ?? 'Profile'}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/pricing`}>
                  <CreditCard className="size-4" aria-hidden="true" />
                  {tNav('pricing') ?? 'Pricing & Plans'}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="size-4" aria-hidden="true" />
                {tNav('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" asChild>
            <Link href={`/${locale}/auth/login?returnUrl=${encodeURIComponent(pathname)}`}>{tNav('login')}</Link>
          </Button>
        )}
      </div>
    </header>

    {/* Mobile Search Overlay */}
    {mobileSearchOpen && (
      <div className="fixed inset-0 z-50 lg:hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={() => setMobileSearchOpen(false)}
        />
        {/* Panel */}
        <div className="relative flex items-center gap-2 p-3 bg-card border-b border-border shadow-md">
          <SearchBox
            locale={locale}
            className="flex-1"
            autoFocus
            onClose={() => setMobileSearchOpen(false)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileSearchOpen(false)}
          >
            {tNav('cancel')}
          </Button>
        </div>
      </div>
    )}
    </>
  )
}
