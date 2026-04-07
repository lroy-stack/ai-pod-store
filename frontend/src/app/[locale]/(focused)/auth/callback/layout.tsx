import { Metadata } from 'next'
import { BRAND, BASE_URL } from '@/lib/store-config'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const title = `Authentication - ${BRAND.name}`
  const description = 'Completing authentication...'
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, url: `${BASE_URL}/${locale}/auth/callback`, siteName: BRAND.name, locale, type: 'website' },
    alternates: {
      canonical: `${BASE_URL}/${locale}/auth/callback`,
      languages: { en: `${BASE_URL}/en/auth/callback`, es: `${BASE_URL}/es/auth/callback`, de: `${BASE_URL}/de/auth/callback` },
    },
  }
}

export default function AuthCallbackLayout({ children }: { children: React.ReactNode }) {
  return children
}
