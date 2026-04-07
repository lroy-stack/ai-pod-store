import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { BRAND, BASE_URL } from '@/lib/store-config'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'profile' })
  const title = `${t('notifications')} - ${BRAND.name}`
  const description = 'View and manage your notifications.'
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/${locale}/profile/notifications`, siteName: BRAND.name, locale, type: 'website' },
    alternates: {
      canonical: `${BASE_URL}/${locale}/profile/notifications`,
      languages: { en: `${BASE_URL}/en/profile/notifications`, es: `${BASE_URL}/es/profile/notifications`, de: `${BASE_URL}/de/profile/notifications` },
    },
  }
}

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children
}
