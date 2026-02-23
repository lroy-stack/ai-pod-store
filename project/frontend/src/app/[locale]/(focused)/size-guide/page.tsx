import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Ruler, Info } from 'lucide-react'

interface SizeGuidePageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: SizeGuidePageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'sizeGuide' })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'POD AI'

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

// Measurement data in inches (source of truth from Printify)
const TSHIRT_SIZES = [
  { size: 'XS', chest: 16.5, length: 27, sleeve: 8.25 },
  { size: 'S', chest: 18, length: 28, sleeve: 8.62 },
  { size: 'M', chest: 20, length: 29, sleeve: 9 },
  { size: 'L', chest: 22, length: 30, sleeve: 9.37 },
  { size: 'XL', chest: 24, length: 31, sleeve: 9.75 },
  { size: '2XL', chest: 26, length: 32, sleeve: 10.12 },
  { size: '3XL', chest: 28, length: 33, sleeve: 10.5 },
]

const HOODIE_SIZES = [
  { size: 'S', chest: 20, length: 27, sleeve: 33.5 },
  { size: 'M', chest: 21, length: 28, sleeve: 34.5 },
  { size: 'L', chest: 23, length: 29, sleeve: 35.5 },
  { size: 'XL', chest: 25, length: 30, sleeve: 36.5 },
  { size: '2XL', chest: 26.5, length: 31, sleeve: 37.5 },
  { size: '3XL', chest: 28, length: 32, sleeve: 38.5 },
]

const PHONE_CASES = [
  { device: 'iPhone 15 Pro Max', models: 'iPhone 15 Pro Max', h: 6.33, w: 3.02 },
  { device: 'iPhone 15 Pro', models: 'iPhone 15 Pro, 15', h: 5.81, w: 2.81 },
  { device: 'iPhone 14 Pro Max', models: 'iPhone 14 Pro Max', h: 6.33, w: 3.05 },
  { device: 'Samsung Galaxy S24', models: 'Galaxy S24', h: 5.79, w: 2.78 },
  { device: 'Samsung Galaxy S24+', models: 'Galaxy S24+', h: 6.24, w: 2.99 },
]

const POSTER_SIZES = [
  { w: 8, h: 10, orientationKey: 'portrait' as const, bestForKey: 'deskSmall' as const },
  { w: 11, h: 14, orientationKey: 'portrait' as const, bestForKey: 'smallMedium' as const },
  { w: 16, h: 20, orientationKey: 'portrait' as const, bestForKey: 'mediumWalls' as const },
  { w: 18, h: 24, orientationKey: 'portraitLandscape' as const, bestForKey: 'largeWalls' as const },
  { w: 24, h: 36, orientationKey: 'portraitLandscape' as const, bestForKey: 'statementPieces' as const },
]

function inToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10
}

function formatMeasure(inches: number, useMetric: boolean): string {
  if (useMetric) return `${inToCm(inches)}`
  return `${inches}`
}

function formatDimensions(h: number, w: number, useMetric: boolean): string {
  if (useMetric) return `${inToCm(h)} × ${inToCm(w)} cm`
  return `${h}" × ${w}"`
}

export default async function SizeGuidePage({ params }: SizeGuidePageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'sizeGuide' })
  const useMetric = locale !== 'en'

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="mb-12 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Ruler className="size-8 text-primary" />
          </div>
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <Info className="mt-1 size-5 text-primary" />
            <div>
              <CardTitle>{t('howToMeasure')}</CardTitle>
              <CardDescription className="mt-2">{t('howToMeasureDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-12">
        {/* T-Shirts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('tshirts')}</CardTitle>
            <CardDescription>{t('tshirtsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('size')}</TableHead>
                    <TableHead>{t('chestWidth')}</TableHead>
                    <TableHead>{t('bodyLength')}</TableHead>
                    <TableHead>{t('sleeveLength')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TSHIRT_SIZES.map((row) => (
                    <TableRow key={row.size}>
                      <TableCell className="font-medium">{row.size}</TableCell>
                      <TableCell>{formatMeasure(row.chest, useMetric)}</TableCell>
                      <TableCell>{formatMeasure(row.length, useMetric)}</TableCell>
                      <TableCell>{formatMeasure(row.sleeve, useMetric)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Hoodies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('hoodies')}</CardTitle>
            <CardDescription>{t('hoodiesDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('size')}</TableHead>
                    <TableHead>{t('chestWidth')}</TableHead>
                    <TableHead>{t('bodyLength')}</TableHead>
                    <TableHead>{t('sleeveLength')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {HOODIE_SIZES.map((row) => (
                    <TableRow key={row.size}>
                      <TableCell className="font-medium">{row.size}</TableCell>
                      <TableCell>{formatMeasure(row.chest, useMetric)}</TableCell>
                      <TableCell>{formatMeasure(row.length, useMetric)}</TableCell>
                      <TableCell>{formatMeasure(row.sleeve, useMetric)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Phone Cases */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('phoneCases')}</CardTitle>
            <CardDescription>{t('phoneCasesDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('device')}</TableHead>
                    <TableHead>{t('compatibleModels')}</TableHead>
                    <TableHead>{t('deviceDimensions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PHONE_CASES.map((row) => (
                    <TableRow key={row.device}>
                      <TableCell className="font-medium">{row.device}</TableCell>
                      <TableCell>{row.models}</TableCell>
                      <TableCell>{formatDimensions(row.h, row.w, useMetric)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Posters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('posters')}</CardTitle>
            <CardDescription>{t('postersDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('size')}</TableHead>
                    <TableHead>{t('posterDimensions')}</TableHead>
                    <TableHead>{t('orientation')}</TableHead>
                    <TableHead>{t('bestFor')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {POSTER_SIZES.map((row) => (
                    <TableRow key={`${row.w}x${row.h}`}>
                      <TableCell className="font-medium">{formatDimensions(row.w, row.h, useMetric)}</TableCell>
                      <TableCell>{formatDimensions(row.w, row.h, useMetric)}</TableCell>
                      <TableCell>{t(row.orientationKey)}</TableCell>
                      <TableCell>{t(row.bestForKey)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('unsureTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('unsureDesc')}{' '}
            <a href={`/${locale}/contact`} className="text-primary hover:underline">
              {t('contactLink')}
            </a>
            . {t('unsureSuffix')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
