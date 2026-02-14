import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { DesignsGallery } from './DesignsGallery'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'designs' })

  return {
    title: t('pageTitle') || 'My Designs',
    description: t('pageDescription') || 'View and manage your AI-generated designs',
  }
}

export default function DesignsPage() {
  return <DesignsGallery />
}
