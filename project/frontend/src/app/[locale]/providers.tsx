import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toaster'
import { CartProvider } from '@/hooks/useCart'
import { WishlistProvider } from '@/hooks/useWishlist'
import { CommandPalette } from '@/components/CommandPalette'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { ThemeLoader } from '@/components/ThemeLoader'
import { CookieConsent } from '@/components/gdpr/CookieConsent'

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
        <CartProvider>
          <WishlistProvider>
            <ServiceWorkerRegistration />
            <ThemeLoader />
            {children}
            <Toaster />
            <CommandPalette />
            <CookieConsent />
          </WishlistProvider>
        </CartProvider>
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
