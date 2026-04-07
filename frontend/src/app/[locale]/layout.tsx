// Copyright (c) 2026 L.LÖWE <maintainer@example.com>
// SPDX-License-Identifier: MIT

import { Inter, Space_Grotesk } from 'next/font/google'
import { Providers } from './providers'
import { getActiveTheme, themeToInlineCSS, themeGoogleFontsURL } from '@/lib/theme-server'
import { getBrandConfig } from '@/lib/brand-config-server'
import '../globals.css'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['400', '500', '600', '700'] })


const locales = ['en', 'es', 'de'] as const

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const localeKey = locale as 'en' | 'es' | 'de'

  // Fetch brand config from database
  const brandConfig = await getBrandConfig()

  const title = brandConfig.seoTitles[localeKey] || brandConfig.seoTitles.en
  const description = brandConfig.seoDescriptions[localeKey] || brandConfig.seoDescriptions.en

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!

  return {
    title,
    description,
    alternates: {
      languages: {
        en: `${baseUrl}/en`,
        es: `${baseUrl}/es`,
        de: `${baseUrl}/de`,
        'x-default': `${baseUrl}/en`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}`,
      siteName: brandConfig.brandName,
      locale: locale === 'es' ? 'es_ES' : locale === 'de' ? 'de_DE' : 'en_US',
      type: 'website',
      images: [{ url: '/brand/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      images: ['/brand/og-image.png'],
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

  // Fetch theme server-side for zero FOUC
  const theme = await getActiveTheme()
  const themeCSS = theme ? themeToInlineCSS(theme) : ''
  const fontsURL = theme ? themeGoogleFontsURL(theme) : null

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <style id="server-theme-style" dangerouslySetInnerHTML={{ __html: themeCSS }} />
        {fontsURL && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={fontsURL} />
          </>
        )}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0b" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable}`}>
        <Providers params={params}>{children}</Providers>
      </body>
    </html>
  )
}
