'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, Bell, ShoppingCart, User, LogOut, Menu } from 'lucide-react'
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

interface StorefrontHeaderProps {
  onToggleSidebar?: () => void
}

export function StorefrontHeader({ onToggleSidebar }: StorefrontHeaderProps) {
  const t = useTranslations('storefront')
  const tNav = useTranslations('navigation')
  const { authenticated, user, loading, logout } = useAuth()
  const { itemCount } = useCart()
  const params = useParams()
  const router = useRouter()
  const locale = params.locale as string

  const handleLogout = async () => {
    await logout()
    router.push(`/${locale}/auth/login`)
  }

  const userInitial = user?.name
    ? user.name[0].toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : '?'

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card">
      {/* Mobile sidebar toggle */}
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden flex-shrink-0"
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      )}

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            className="pl-9 rounded-full bg-muted border-0"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
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
