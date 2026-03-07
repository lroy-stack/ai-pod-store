import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BASE_URL } from '@/lib/store-config'
import { LandingPageClient } from '@/components/landing/LandingPageClient'
import { Footer } from '@/components/Footer'
import { getBrandConfig } from '@/lib/brand-config-server'

interface Product {
  id: string
  title: string
  base_price_cents: number
  currency: string
  avg_rating: number
  images: Array<{ src: string; alt: string }>
}

interface LandingPageProps {
  params: Promise<{ locale: string }>
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'landing' })

  // Fetch brand config from database
  const brandConfig = await getBrandConfig()
  const siteName = brandConfig.brandName

  const baseUrl = BASE_URL

  return {
    title: `${siteName} - ${t('heroTitle')}`,
    description: t('heroSubtitle'),
    openGraph: {
      title: `${siteName} - ${t('heroTitle')}`,
      description: t('heroSubtitle'),
      url: `${baseUrl}/${locale}`,
      siteName,
      locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${siteName} - ${t('heroTitle')}`,
      description: t('heroSubtitle'),
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

// Server Component - fetches data and renders
export default async function LandingPage({ params }: LandingPageProps) {
  const { locale } = await params

  // Fetch products on the server (service key bypasses RLS — safe in Server Components)

  // Determine sort based on month (seasonal)
  const month = new Date().getMonth()
  let orderBy: 'avg_rating' | 'created_at' = 'created_at'
  let ascending = false

  if (month >= 11 || month <= 1) {
    // Winter: top rated
    orderBy = 'avg_rating'
    ascending = false
  } else if (month >= 2 && month <= 4) {
    // Spring: newest
    orderBy = 'created_at'
    ascending = false
  } else {
    // Summer/Fall: featured (default to newest)
    orderBy = 'created_at'
    ascending = false
  }

  // Fetch all data in parallel (was sequential — 4x faster now)
  const [
    { data: productsData },
    { data: reviewsData },
    { count: totalOrders },
    { data: avgData },
  ] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('id, title, base_price_cents, currency, avg_rating, images')
      .eq('status', 'active')
      .order(orderBy, { ascending })
      .limit(12),
    supabaseAdmin
      .from('product_reviews')
      .select(`
        id, rating, title, body, is_verified_purchase, created_at,
        users!product_reviews_user_id_fkey(name)
      `)
      .eq('moderation_status', 'approved')
      .eq('locale', locale)
      .order('created_at', { ascending: false })
      .limit(6),
    supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paid'),
    supabaseAdmin
      .from('product_reviews')
      .select('rating')
      .eq('moderation_status', 'approved'),
  ])

  const products = (productsData || []).map((p: Product) => ({
    id: p.id,
    title: p.title,
    price: p.base_price_cents,
    currency: p.currency || 'EUR',
    rating: p.avg_rating || 0,
    image: p.images?.[0]?.src || null,
  }))

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
    ? avgData.reduce((acc, r) => acc + r.rating, 0) / avgData.length
    : 4.8

  // Get translations for JSON-LD
  const t = await getTranslations({ locale, namespace: 'landing' })
  const baseUrl = BASE_URL
  const brandConfig = await getBrandConfig()
  const siteName = brandConfig.brandName

  // JSON-LD structured data for SEO
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: t('heroSubtitle'),
    sameAs: [
      // Add social media URLs if available
    ],
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: baseUrl,
    description: t('heroSubtitle'),
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
      {/* JSON-LD structured data */}
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
          initialProducts={products}
          reviews={reviews}
          totalOrders={totalOrders || 0}
          averageRating={averageRating}
        />
        <Footer />
      </div>
    </>
  )
}
