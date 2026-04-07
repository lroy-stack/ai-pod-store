import { Metadata } from 'next'
import { BRAND, BASE_URL } from '@/lib/store-config'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const title = `Shared Wishlist - ${BRAND.name}`
  const description = 'View a shared wishlist and discover curated products.'
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/${locale}/wishlist/shared`, siteName: BRAND.name, locale, type: 'website' },
    alternates: {
      canonical: `${BASE_URL}/${locale}/wishlist/shared`,
      languages: { en: `${BASE_URL}/en/wishlist/shared`, es: `${BASE_URL}/es/wishlist/shared`, de: `${BASE_URL}/de/wishlist/shared` },
    },
  }
}

export default function SharedWishlistLayout({ children }: { children: React.ReactNode }) {
  return children
}
