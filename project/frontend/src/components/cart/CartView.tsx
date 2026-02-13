'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function CartView({ locale }: { locale: string }) {
  const t = useTranslations('Cart')
  const tNav = useTranslations('navigation')
  const { authenticated, loading } = useAuth()

  // Mock cart data (will be replaced with real cart data in future features)
  const cartItems: any[] = []
  const cartTotal = 0

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-500">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">{t('title')}</h1>

      {cartItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">{t('emptyCart')}</p>
          <Link
            href={`/${locale}/shop`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            {t('continueShopping')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Cart items will be rendered here */}
              <div className="p-6">
                <p className="text-gray-700">{t('itemsInCart', { count: cartItems.length })}</p>
              </div>
            </div>
          </div>

          {/* Cart summary and checkout options */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('orderSummary')}</h2>

              <div className="border-t border-gray-200 pt-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">{t('subtotal')}</span>
                  <span className="text-gray-900 font-medium">${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">{t('shipping')}</span>
                  <span className="text-gray-900 font-medium">{t('calculated')}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                  <span className="text-lg font-bold text-gray-900">{t('total')}</span>
                  <span className="text-lg font-bold text-gray-900">${cartTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout options based on auth state */}
              <div className="space-y-3">
                {authenticated ? (
                  <Link
                    href={`/${locale}/checkout`}
                    className="block w-full text-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {t('proceedToCheckout')}
                  </Link>
                ) : (
                  <>
                    <Link
                      href={`/${locale}/checkout?guest=true`}
                      className="block w-full text-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {t('guestCheckout')}
                    </Link>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">{t('or')}</span>
                      </div>
                    </div>

                    <Link
                      href={`/${locale}/auth/login?returnUrl=/${locale}/checkout`}
                      className="block w-full text-center px-4 py-3 border border-blue-600 text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {t('signInToCheckout')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
