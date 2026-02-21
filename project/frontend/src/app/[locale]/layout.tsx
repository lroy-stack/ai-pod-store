import { Inter } from 'next/font/google'
import { Providers } from './providers'
import '../globals.css'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

const locales = ['en', 'es', 'de'] as const

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

// Locale-aware metadata
const metadataByLocale = {
  en: {
    title: 'POD AI — AI-Powered Print on Demand Store',
    description: 'Create custom designs with AI and get them printed on premium products. Your AI-powered print-on-demand marketplace.',
  },
  es: {
    title: 'POD AI — Tienda de Impresión bajo Demanda con IA',
    description: 'Crea diseños personalizados con IA e imprímelos en productos premium. Tu tienda de impresión bajo demanda impulsada por IA.',
  },
  de: {
    title: 'POD AI — KI-gestützter Print-on-Demand-Shop',
    description: 'Erstelle individuelle Designs mit KI und lass sie auf Premium-Produkte drucken. Dein KI-gesteuerter Print-on-Demand-Marktplatz.',
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const localeKey = locale as keyof typeof metadataByLocale
  const metadata = metadataByLocale[localeKey] || metadataByLocale.en

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://podai.com'

  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      languages: {
        en: `${baseUrl}/en`,
        es: `${baseUrl}/es`,
        de: `${baseUrl}/de`,
        'x-default': `${baseUrl}/en`,
      },
    },
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      url: `${baseUrl}/${locale}`,
      siteName: 'POD AI',
      locale: locale === 'es' ? 'es_ES' : locale === 'de' ? 'de_DE' : 'en_US',
      type: 'website',
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0b" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={inter.className}>
        <Providers params={params}>{children}</Providers>
      </body>
    </html>
  )
}
