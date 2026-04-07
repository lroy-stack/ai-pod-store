import { Metadata } from 'next'
import { BRAND, BASE_URL } from '@/lib/store-config'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const title = `Offline - ${BRAND.name}`
  const description = 'You are currently offline. Some cached content may still be available.'
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/${locale}/offline`, siteName: BRAND.name, locale, type: 'website' },
    alternates: {
      canonical: `${BASE_URL}/${locale}/offline`,
      languages: { en: `${BASE_URL}/en/offline`, es: `${BASE_URL}/es/offline`, de: `${BASE_URL}/de/offline` },
    },
  }
}

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children
}
