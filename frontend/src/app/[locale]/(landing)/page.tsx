import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BASE_URL } from '@/lib/store-config'
import { LandingPageClient } from '@/components/landing/LandingPageClient'
import { Footer } from '@/components/Footer'
import { getBrandConfig } from '@/lib/brand-config-server'
import { getActiveCampaign } from '@/lib/marketing-server'

interface LandingPageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { locale } = await params
  const localeKey = locale as 'en' | 'es' | 'de'
  const brandConfig = await getBrandConfig()
  const siteName = brandConfig.brandName
  const baseUrl = BASE_URL

  // Try to get campaign title for SEO
  const campaign = await getActiveCampaign()
  const campaignTitle = campaign?.title?.[localeKey] || campaign?.title?.en
  const t = await getTranslations({ locale, namespace: 'landing' })

  const title = campaignTitle
    ? `${siteName} — ${campaignTitle}`
    : `${siteName} - ${t('fallbackTitle')}`
  const description = campaign?.sub_cta_text?.[localeKey] || t('fallbackSubtitle')
  const ogImage = campaign?.og_image_url || '/brand/og-image.png'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}`,
      siteName,
      locale: locale === 'es' ? 'es_ES' : locale === 'de' ? 'de_DE' : 'en_US',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: {
        'en': `${baseUrl}/en`,
        'es': `${baseUrl}/es`,
        'de': `${baseUrl}/de`,
        'x-default': `${baseUrl}/en`,
      },
    },
  }
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { locale } = await params
  const localeKey = locale as 'en' | 'es' | 'de'

  // Fetch campaign + reviews in parallel
  const [campaign, { data: reviewsData }, { count: totalOrders }, { data: avgData }] = await Promise.all([
    getActiveCampaign(),
    supabaseAdmin
      .from('product_reviews')
      .select(`
        id, rating, title, body, is_verified_purchase, created_at,
        users!product_reviews_user_id_fkey(name)
      `)
      .eq('moderation_status', 'approved')
      .eq('locale', locale)
      .order('created_at', { ascending: false })
      .limit(3),
    supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paid'),
    supabaseAdmin
      .from('product_reviews')
      .select('rating')
      .eq('moderation_status', 'approved'),
  ])

  // Extract collection products from campaign
  const collectionProducts = campaign?.collection?.collection_products
    ?.filter((cp) => cp.product?.status === 'active')
    ?.map((cp) => ({
      id: cp.product.id,
      slug: cp.product.slug,
      title: cp.product.title,
      price: cp.product.base_price_cents / 100,
      compare_at_price: cp.product.compare_at_price_cents ? cp.product.compare_at_price_cents / 100 : null,
      currency: cp.product.currency || 'EUR',
      image: cp.product.images?.[0]?.src || null,
      rating: cp.product.avg_rating || 0,
      is_featured: cp.is_featured,
    })) ?? []

  const collectionName = campaign?.collection?.name?.[localeKey]
    || campaign?.collection?.name?.en
    || ''
  const collectionSlug = campaign?.collection?.slug || ''

  const reviews = (reviewsData || []).map((r: any) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    user_name: r.users?.name || 'Anonymous',
    is_verified_purchase: r.is_verified_purchase,
    created_at: r.created_at,
  }))

  const averageRating = avgData && avgData.length > 0
    ? avgData.reduce((acc: number, r: any) => acc + r.rating, 0) / avgData.length
    : 4.8

  // Get translations for JSON-LD
  const t = await getTranslations({ locale, namespace: 'landing' })
  const baseUrl = BASE_URL
  const brandConfig = await getBrandConfig()
  const siteName = brandConfig.brandName

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: t('brandStatement'),
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: baseUrl,
    description: t('brandBody'),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/${locale}/shop?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      <div className="flex flex-col">
        <LandingPageClient
          locale={locale}
          campaign={campaign}
          collectionProducts={collectionProducts}
          collectionName={collectionName}
          collectionSlug={collectionSlug}
          reviews={reviews}
          totalOrders={totalOrders || 0}
          averageRating={averageRating}
        />
        <Footer />
      </div>
    </>
  )
}
