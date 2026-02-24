import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { getActiveTheme, themeToInlineCSS, themeGoogleFontsURL } from '@/lib/theme-server'
import { getBrandConfig } from '@/lib/brand-config-server'
import '../globals.css'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://podai.com'

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
        {themeCSS && (
          <style id="server-theme-style" dangerouslySetInnerHTML={{ __html: themeCSS }} />
        )}
        {fontsURL && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={fontsURL} />
          </>
        )}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0b" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={inter.variable}>
        <Providers params={params}>{children}</Providers>
      </body>
    </html>
  )
}
