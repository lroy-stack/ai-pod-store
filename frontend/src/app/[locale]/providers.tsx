import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/providers/AuthProvider'
import { UsageProvider } from '@/providers/UsageProvider'
import { CartProvider } from '@/hooks/useCart'
import { WishlistProvider } from '@/hooks/useWishlist'
import { DesignProvider } from '@/components/storefront/DesignContext'
import { ChatHistoryProvider } from '@/components/chat/ChatHistoryContext'
import { CommandPalette } from '@/components/CommandPalette'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { ThemeLoader } from '@/components/ThemeLoader'
import { CookieConsent } from '@/components/gdpr/CookieConsent'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const locales = ['en', 'es', 'de']

async function ProvidersContent({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Validate locale
  if (!locales.includes(locale)) {
    notFound()
  }

  const messages = await getMessages({ locale })

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <UsageProvider>
            <CartProvider>
              <WishlistProvider>
                <DesignProvider>
                  <ChatHistoryProvider>
                  <ErrorBoundary>
                    <ServiceWorkerRegistration />
                    <ThemeLoader />
                    {children}
                    <Toaster />
                    <CommandPalette />
                    <CookieConsent />
                  </ErrorBoundary>
                  </ChatHistoryProvider>
                </DesignProvider>
              </WishlistProvider>
            </CartProvider>
          </UsageProvider>
        </AuthProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  )
}

export function Providers({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-background" />
      }
    >
      <ProvidersContent params={params}>{children}</ProvidersContent>
    </Suspense>
  )
}
