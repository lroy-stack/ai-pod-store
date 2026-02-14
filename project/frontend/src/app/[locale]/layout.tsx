import { Inter } from 'next/font/google'
import { Providers } from './providers'
import '../globals.css'

const inter = Inter({ subsets: ['latin'] })

const locales = ['en', 'es', 'de']

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  return (
    <html suppressHydrationWarning>
      <body className={inter.className}>
        <Providers params={params}>{children}</Providers>
      </body>
    </html>
  )
}
