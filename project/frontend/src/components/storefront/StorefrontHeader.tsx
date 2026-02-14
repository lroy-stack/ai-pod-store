'use client'

import Link from 'next/link'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, Bell, ShoppingCart, User, LogOut, Menu, Globe } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'

interface StorefrontHeaderProps {
  onToggleSidebar?: () => void
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

export function StorefrontHeader({ onToggleSidebar }: StorefrontHeaderProps) {
  const t = useTranslations('storefront')
  const tNav = useTranslations('navigation')
  const { authenticated, user, loading, logout } = useAuth()
  const { itemCount } = useCart()
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const locale = params.locale as string

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

  const isShopPage = pathname.includes('/shop')
  const isChatPage = pathname === `/${locale}` || pathname === `/${locale}/`

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card">
      {/* Left: Mobile toggle + Logo + Nav links */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Mobile sidebar toggle */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onToggleSidebar}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        )}

        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="size-8 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">P</span>
          </div>
          <span className="font-semibold text-foreground hidden sm:inline">POD AI</span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              'text-muted-foreground hover:text-foreground',
              isChatPage && 'text-foreground bg-muted'
            )}
          >
            <Link href={`/${locale}`}>{tNav('chat') || 'Chat'}</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              'text-muted-foreground hover:text-foreground',
              isShopPage && 'text-foreground bg-muted'
            )}
          >
            <Link href={`/${locale}/shop`}>{tNav('shop') || 'Shop'}</Link>
          </Button>
        </nav>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md hidden lg:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            className="pl-9 rounded-full bg-muted border-0"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>

        {/* Cart */}
        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link href={`/${locale}/cart`}>
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
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
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
              <Globe className="h-5 w-5" />
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
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{user.name || user.email}</p>
                {user.name && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/profile`}>
                  <User className="size-4" />
                  {tNav('profile') ?? 'Profile'}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="size-4" />
                {tNav('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" asChild>
            <Link href={`/${locale}/auth/login`}>{tNav('login')}</Link>
          </Button>
        )}
      </div>
    </header>
  )
}
