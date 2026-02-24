import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@supabase/supabase-js'
import { LandingPageClient } from '@/components/landing/LandingPageClient'
import { Testimonials } from '@/components/landing/Testimonials'
import { Footer } from '@/components/Footer'

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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'POD AI'

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
      },
    },
  }
}

// Server Component - fetches data and renders
export default async function LandingPage({ params }: LandingPageProps) {
  const { locale } = await params

  // Fetch products on the server (using anon key for public data)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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

  const { data: productsData } = await supabase
    .from('products')
    .select('id, title, base_price_cents, currency, avg_rating, images')
    .eq('status', 'active')
    .order(orderBy, { ascending })
    .limit(12)

  // Transform products for client component
  const products = (productsData || []).map((p: Product) => ({
    id: p.id,
    title: p.title,
    price: p.base_price_cents,
    currency: p.currency || 'EUR',
    rating: p.avg_rating || 0,
    image: p.images?.[0]?.src || null,
  }))

  // Fetch testimonials (approved reviews with user info)
  const { data: reviewsData } = await supabase
    .from('product_reviews')
    .select(`
      id,
      rating,
      title,
      body,
      is_verified_purchase,
      created_at,
      users!inner(name)
    `)
    .eq('moderation_status', 'approved')
    .eq('locale', locale)
    .order('created_at', { ascending: false })
    .limit(6)

  const reviews = (reviewsData || []).map((r: any) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    user_name: r.users?.name || 'Anonymous',
    is_verified_purchase: r.is_verified_purchase,
    created_at: r.created_at,
  }))

  // Fetch trust signals (total orders count)
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('payment_status', 'paid')

  // Calculate average rating from all approved reviews
  const { data: avgData } = await supabase
    .from('product_reviews')
    .select('rating')
    .eq('moderation_status', 'approved')

  const averageRating = avgData && avgData.length > 0
    ? avgData.reduce((acc, r) => acc + r.rating, 0) / avgData.length
    : 4.8 // Default fallback

  // Get translations for JSON-LD
  const t = await getTranslations({ locale, namespace: 'landing' })
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'POD AI'

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
        <LandingPageClient locale={locale} initialProducts={products} />
        <Testimonials
          reviews={reviews}
          totalOrders={totalOrders || 0}
          averageRating={averageRating}
        />
        <Footer />
      </div>
    </>
  )
}
