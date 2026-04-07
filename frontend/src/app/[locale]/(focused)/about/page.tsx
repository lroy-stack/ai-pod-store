import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { BRAND, BASE_URL } from '@/lib/store-config'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Palette, Zap, Users } from 'lucide-react'

interface AboutPageProps {
  params: Promise<{ locale: string }>
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params

  const baseUrl = BASE_URL
  const siteName = BRAND.name

  const titles: Record<string, string> = {
    en: `About Us - ${siteName}`,
    es: `Sobre Nosotros - ${siteName}`,
    de: `Über Uns - ${siteName}`,
  }
  const descriptions: Record<string, string> = {
    en: 'Learn about ' + process.env.NEXT_PUBLIC_SITE_NAME! + ' - the AI-powered print-on-demand platform that makes custom product creation easy and accessible for everyone.',
    es: 'Conoce ' + process.env.NEXT_PUBLIC_SITE_NAME! + ' - la plataforma de impresión bajo demanda impulsada por IA que hace la creación de productos personalizados fácil y accesible para todos.',
    de: 'Erfahren Sie mehr über ' + process.env.NEXT_PUBLIC_SITE_NAME! + ' - die KI-gestützte Print-on-Demand-Plattform, die individuelle Produkterstellung einfach und für jeden zugänglich macht.',
  }
  const title = titles[locale] || titles.en
  const description = descriptions[locale] || descriptions.en

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/about`,
      siteName,
      locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/about`,
      languages: {
        'en': `${baseUrl}/en/about`,
        'es': `${baseUrl}/es/about`,
        'de': `${baseUrl}/de/about`,
        'x-default': `${baseUrl}/en/about`,
      },
    },
  }
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'about' })

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('missionTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p className="text-muted-foreground">
              {t('missionText')}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="size-6 text-primary" />
              </div>
              <CardTitle>{t('featureAiTitle')}</CardTitle>
              <CardDescription>
                {t('featureAiSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('featureAiText')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Palette className="size-6 text-primary" />
              </div>
              <CardTitle>{t('featureProductsTitle')}</CardTitle>
              <CardDescription>
                {t('featureProductsSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('featureProductsText')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="size-6 text-primary" />
              </div>
              <CardTitle>{t('featureFulfillmentTitle')}</CardTitle>
              <CardDescription>
                {t('featureFulfillmentSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('featureFulfillmentText')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="size-6 text-primary" />
              </div>
              <CardTitle>{t('featureCommunityTitle')}</CardTitle>
              <CardDescription>
                {t('featureCommunitySubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('featureCommunityText')}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('storyTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p className="text-muted-foreground">
              {t('storyP1')}
            </p>
            <p className="text-muted-foreground">
              {t('storyP2')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>{t('whyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>{t('whyNoCost')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>{t('whyAi')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>{t('whySustainable')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>{t('whySecure')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>{t('whySupport')}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
