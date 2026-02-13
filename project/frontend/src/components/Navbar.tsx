'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useParams, useRouter } from 'next/navigation'

export default function Navbar() {
  const t = useTranslations('navigation')
  const { authenticated, user, loading, logout } = useAuth()
  const params = useParams()
  const router = useRouter()
  const locale = params.locale as string

  const handleLogout = async () => {
    await logout()
    router.push(`/${locale}/auth/login`)
  }

  return (
    <nav className="bg-card/80 backdrop-blur-xl shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Brand and main navigation */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href={`/${locale}/`} className="text-2xl font-bold text-primary">
                POD AI
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href={`/${locale}/`}
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-foreground hover:text-primary"
              >
                {t('home')}
              </Link>
              <Link
                href={`/${locale}/shop`}
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-foreground hover:text-primary"
              >
                {t('shop')}
              </Link>
            </div>
          </div>

          {/* Right side - Auth status */}
          <div className="flex items-center">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : authenticated && user ? (
              <div className="flex items-center space-x-4">
                <Link
                  href={`/${locale}/cart`}
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  {t('cart')}
                </Link>
                <Link
                  href={`/${locale}/orders`}
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  {t('orders')}
                </Link>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                    {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground">{user.name || user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                >
                  {t('logout')}
                </button>
              </div>
            ) : (
              <Link
                href={`/${locale}/auth/login`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
              >
                {t('login')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
