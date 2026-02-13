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
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Brand and main navigation */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href={`/${locale}/`} className="text-2xl font-bold text-blue-600">
                POD AI
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href={`/${locale}/`}
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-blue-600"
              >
                {t('home')}
              </Link>
              <Link
                href={`/${locale}/shop`}
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-blue-600"
              >
                {t('shop')}
              </Link>
            </div>
          </div>

          {/* Right side - Auth status */}
          <div className="flex items-center">
            {loading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : authenticated && user ? (
              <div className="flex items-center space-x-4">
                <Link
                  href={`/${locale}/cart`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  {t('cart')}
                </Link>
                <Link
                  href={`/${locale}/orders`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  {t('orders')}
                </Link>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{user.name || user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('logout')}
                </button>
              </div>
            ) : (
              <Link
                href={`/${locale}/auth/login`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
