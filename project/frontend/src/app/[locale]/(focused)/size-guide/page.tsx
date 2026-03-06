import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { BRAND, BASE_URL } from '@/lib/store-config'
import { SizeGuideContent } from './size-guide-content'

interface SizeGuidePageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: SizeGuidePageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'sizeGuide' })

  const baseUrl = BASE_URL
  const siteName = BRAND.name

  return {
    title: `${t('title')} - ${siteName}`,
    description: t('subtitle'),
    openGraph: {
      title: `${t('title')} - ${siteName}`,
      description: t('subtitle'),
      url: `${baseUrl}/${locale}/size-guide`,
      siteName,
      locale,
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/size-guide`,
      languages: { en: `${baseUrl}/en/size-guide`, es: `${baseUrl}/es/size-guide`, de: `${baseUrl}/de/size-guide` },
    },
  }
}

const TRANSLATION_KEYS = [
  'title', 'subtitle', 'howToMeasure', 'howToMeasureDesc',
  'tshirts', 'hoodies', 'phoneCases', 'phoneCasesDesc', 'posters',
  'size', 'chestWidth', 'bodyLength', 'sleeveLength',
  'device', 'compatibleModels', 'deviceDimensions', 'posterDimensions',
  'orientation', 'bestFor',
  'portrait', 'landscape', 'portraitLandscape',
  'deskSmall', 'smallMedium', 'mediumWalls', 'largeWalls', 'statementPieces',
  'unsureTitle', 'unsureDesc', 'contactLink', 'unsureSuffix',
  'toggleUnit', 'unisexSizing', 'measurementsIn', 'availableSizes',
] as const

export default async function SizeGuidePage({ params }: SizeGuidePageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'sizeGuide' })

  const translations: Record<string, string> = {}
  for (const key of TRANSLATION_KEYS) {
    translations[key] = t(key)
  }

  return <SizeGuideContent locale={locale} t={translations} />
}
