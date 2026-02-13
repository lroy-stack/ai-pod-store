'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Menu,
  ShoppingCart,
  Package,
  Home,
  Store,
  LogOut,
  User,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

/**
 * Navbar — Reference component for responsive + shadcn/ui patterns.
 *
 * Mobile  (< md): Logo + hamburger Sheet with stacked nav links
 * Desktop (>= md): Logo + horizontal links + Avatar DropdownMenu
 *
 * Uses: Button, Avatar, DropdownMenu, Sheet, Separator, cn()
 * Glass effect: bg-card/80 backdrop-blur-xl
 * Sticky: sticky top-0 z-50
 */
export default function Navbar() {
  const t = useTranslations('navigation')
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

  const navLinks = [
    { href: `/${locale}/`, label: t('home'), icon: Home },
    { href: `/${locale}/shop`, label: t('shop'), icon: Store },
  ]

  const authLinks = [
    { href: `/${locale}/cart`, label: t('cart'), icon: ShoppingCart },
    { href: `/${locale}/orders`, label: t('orders'), icon: Package },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Desktop nav links */}
          <div className="flex items-center gap-6">
            <Link
              href={`/${locale}/`}
              className="text-2xl font-bold text-primary shrink-0"
            >
              POD AI
            </Link>

            {/* Desktop nav — hidden on mobile */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Button key={link.href} variant="ghost" size="sm" asChild>
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </div>
          </div>

          {/* Right: Desktop auth area */}
          <div className="hidden md:flex items-center gap-2">
            {loading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : authenticated && user ? (
              <>
                {authLinks.map((link) => (
                  <Button key={link.href} variant="ghost" size="sm" asChild>
                    <Link href={link.href} className="relative">
                      <link.icon className="size-4" />
                      {link.label}
                      {link.icon === ShoppingCart && itemCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 size-5 flex items-center justify-center p-0 text-xs"
                        >
                          {itemCount}
                        </Badge>
                      )}
                    </Link>
                  </Button>
                ))}

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* User dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 px-2"
                    >
                      <Avatar className="size-7">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {userInitial}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden lg:inline text-sm font-medium max-w-[120px] truncate">
                        {user.name || user.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-sm font-medium">{user.name || user.email}</p>
                      {user.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/${locale}/profile`}>
                        <User className="size-4" />
                        {t('profile') ?? 'Profile'}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={handleLogout}
                    >
                      <LogOut className="size-4" />
                      {t('logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button size="sm" asChild>
                <Link href={`/${locale}/auth/login`}>{t('login')}</Link>
              </Button>
            )}
          </div>

          {/* Mobile: Hamburger menu */}
          <div className="flex md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="size-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="text-primary text-xl">
                    POD AI
                  </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col gap-1 px-2">
                  {/* Nav links */}
                  {navLinks.map((link) => (
                    <Button
                      key={link.href}
                      variant="ghost"
                      className="justify-start gap-3 h-11"
                      asChild
                    >
                      <Link href={link.href}>
                        <link.icon className="size-4" />
                        {link.label}
                      </Link>
                    </Button>
                  ))}

                  {authenticated && user && (
                    <>
                      <Separator className="my-2" />
                      {authLinks.map((link) => (
                        <Button
                          key={link.href}
                          variant="ghost"
                          className="justify-start gap-3 h-11"
                          asChild
                        >
                          <Link href={link.href} className="relative">
                            <link.icon className="size-4" />
                            {link.label}
                            {link.icon === ShoppingCart && itemCount > 0 && (
                              <Badge
                                variant="destructive"
                                className="ml-auto size-5 flex items-center justify-center p-0 text-xs"
                              >
                                {itemCount}
                              </Badge>
                            )}
                          </Link>
                        </Button>
                      ))}
                    </>
                  )}
                </div>

                {/* Bottom: Auth area */}
                <div className="mt-auto px-2 pb-4">
                  <Separator className="mb-4" />
                  {loading ? (
                    <span className="text-sm text-muted-foreground">
                      Loading...
                    </span>
                  ) : authenticated && user ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 px-2">
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            {userInitial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">
                            {user.name || user.email}
                          </span>
                          {user.name && (
                            <span className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3"
                        onClick={handleLogout}
                      >
                        <LogOut className="size-4" />
                        {t('logout')}
                      </Button>
                    </div>
                  ) : (
                    <Button className="w-full" asChild>
                      <Link href={`/${locale}/auth/login`}>{t('login')}</Link>
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
