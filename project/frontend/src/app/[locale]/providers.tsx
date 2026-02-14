import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Toaster } from '@/components/ui/toaster'
import { CartProvider } from '@/hooks/useCart'

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
      <CartProvider>
        <Navbar />
        {children}
        <Toaster />
      </CartProvider>
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
        <div className="min-h-screen bg-background">
          <div className="h-16 bg-card/80 border-b border-border" />
        </div>
      }
    >
      <ProvidersContent params={params}>{children}</ProvidersContent>
    </Suspense>
  )
}
