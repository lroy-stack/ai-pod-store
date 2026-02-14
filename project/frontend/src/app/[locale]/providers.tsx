import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Toaster } from '@/components/ui/toaster'
import { CartProvider } from '@/hooks/useCart'
import { CommandPalette } from '@/components/CommandPalette'

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
        {children}
        <Toaster />
        <CommandPalette />
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
        <div className="min-h-dvh bg-background" />
      }
    >
      <ProvidersContent params={params}>{children}</ProvidersContent>
    </Suspense>
  )
}
