import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { BRAND, BASE_URL } from '@/lib/store-config'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'wishlist' })
  const title = `${t('title')} - ${BRAND.name}`
  const description = t('emptyDescription')
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/${locale}/wishlist`, siteName: BRAND.name, locale, type: 'website' },
    alternates: {
      canonical: `${BASE_URL}/${locale}/wishlist`,
      languages: { en: `${BASE_URL}/en/wishlist`, es: `${BASE_URL}/es/wishlist`, de: `${BASE_URL}/de/wishlist` },
    },
  }
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children
}
