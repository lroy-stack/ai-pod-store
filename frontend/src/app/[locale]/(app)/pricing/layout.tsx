import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { BRAND, BASE_URL } from '@/lib/store-config'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pricing' })
  const title = `${t('title')} - ${BRAND.name}`
  const description = t('subtitle')
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/${locale}/pricing`, siteName: BRAND.name, locale, type: 'website' },
    alternates: {
      canonical: `${BASE_URL}/${locale}/pricing`,
      languages: { en: `${BASE_URL}/en/pricing`, es: `${BASE_URL}/es/pricing`, de: `${BASE_URL}/de/pricing` },
    },
  }
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
