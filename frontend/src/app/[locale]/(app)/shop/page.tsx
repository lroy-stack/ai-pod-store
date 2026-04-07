import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BRAND, BASE_URL } from '@/lib/store-config'
import Link from 'next/link'
import { ShopPageClient } from '@/components/shop/ShopPageClient'
import { ShopHeroBanner } from '@/components/shop/ShopHeroBanner'
import { sanitizeForLike } from '@/lib/query-sanitizer'
import { getActiveCampaign } from '@/lib/marketing-server'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'

interface Product {
  id: string
  title: string
  description: string
  base_price_cents: number
  currency: string
  avg_rating: number
  review_count: number
  category_id: string
  categories: { slug: string } | { slug: string }[] | null
  status: string
  created_at: string
  images: Array<{ src: string; alt: string }>
}

/** Batch-fetch variants from product_variants table, grouped by product_id */
async function fetchVariantsByProductId(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, { sizes: string[]; colors: string[]; colorImages: Record<string, string>; hasVariantPricing?: boolean; maxPrice?: number }>()

  const { data: allVariants } = await supabaseAdmin
    .from('product_variants')
    .select('product_id, size, color, image_url, price_cents')
    .in('product_id', productIds)
    .eq('is_enabled', true)
    .eq('is_available', true)
    .order('color', { ascending: false })

  const grouped = new Map<string, { sizes: Set<string>; colors: Set<string>; colorImages: Map<string, string>; prices: Set<number> }>()
  for (const v of allVariants || []) {
    if (!grouped.has(v.product_id)) {
      grouped.set(v.product_id, { sizes: new Set(), colors: new Set(), colorImages: new Map(), prices: new Set() })
    }
    const entry = grouped.get(v.product_id)!
    if (v.size) entry.sizes.add(v.size)
    if (v.color) {
      entry.colors.add(v.color)
      if (v.image_url && !entry.colorImages.has(v.color)) {
        entry.colorImages.set(v.color, v.image_url)
      }
    }
    if (v.price_cents != null) entry.prices.add(v.price_cents)
  }

  const result = new Map<string, { sizes: string[]; colors: string[]; colorImages: Record<string, string>; hasVariantPricing?: boolean; maxPrice?: number }>()
  for (const [id, { sizes, colors, colorImages, prices }] of grouped) {
    const priceArr = [...prices]
    const hasVariantPricing = priceArr.length > 1 && Math.min(...priceArr) !== Math.max(...priceArr)
    result.set(id, {
      sizes: [...sizes],
      colors: [...colors],
      colorImages: Object.fromEntries(colorImages),
      ...(hasVariantPricing ? { hasVariantPricing: true, maxPrice: Math.max(...priceArr) / 100 } : {}),
    })
  }
  return result
}

interface ShopPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

type SortOption = 'featured' | 'priceLowToHigh' | 'priceHighToLow' | 'newest' | 'topRated'

const PRODUCTS_PER_PAGE = 20

// Revalidate every 5 minutes — shop data changes infrequently
export const revalidate = 300

// Server Component - generates metadata for SEO
export async function generateMetadata({ params, searchParams }: ShopPageProps): Promise<Metadata> {
  const { locale } = await params
  const search = await searchParams
  const t = await getTranslations({ locale, namespace: 'shop' })

  const baseUrl = BASE_URL
  const siteName = BRAND.name

  const query = search.q as string | undefined

  let title = `${t('title')} - ${siteName}`
  let description = t('subtitle')

  if (query) {
    title = `Search: ${query} - ${siteName}`
    description = `Search results for "${query}" in our custom print-on-demand products`
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/shop`,
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
      canonical: `${baseUrl}/${locale}/shop`,
      languages: {
        'en': `${baseUrl}/en/shop`,
        'es': `${baseUrl}/es/shop`,
        'de': `${baseUrl}/de/shop`,
        'x-default': `${baseUrl}/en/shop`,
      },
    },
  }
}

// Server Component - fetches data and renders
export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { locale } = await params
  const search = await searchParams
  const query = search.q as string | undefined
  const isSearchMode = !!(query && query.trim())

  const t = await getTranslations({ locale, namespace: 'shop' })
  const baseUrl = BASE_URL
  const siteName = BRAND.name

  const sort = (search.sort as SortOption) || 'featured'

  // ── Build product query ──
  let productsQuery = supabaseAdmin
    .from('products')
    .select('id, slug, title, description, base_price_cents, compare_at_price_cents, currency, avg_rating, review_count, category_id, categories(slug), status, created_at, images, translations', { count: 'exact' })
    .eq('status', 'active')
    .is('deleted_at', null)

  // Search mode: filter by query text
  if (isSearchMode) {
    const safeQuery = sanitizeForLike(query, 'both')
    productsQuery = productsQuery.or(`title.ilike.${safeQuery},description.ilike.${safeQuery}`)
  }

  switch (sort) {
    case 'priceLowToHigh':
      productsQuery = productsQuery.order('base_price_cents', { ascending: true })
      break
    case 'priceHighToLow':
      productsQuery = productsQuery.order('base_price_cents', { ascending: false })
      break
    case 'newest':
      productsQuery = productsQuery.order('created_at', { ascending: false })
      break
    case 'topRated':
      productsQuery = productsQuery.order('avg_rating', { ascending: false })
      break
    case 'featured':
    default:
      productsQuery = productsQuery.order('created_at', { ascending: false })
      break
  }

  productsQuery = productsQuery.range(0, PRODUCTS_PER_PAGE - 1)

  // Fetch products + campaign in parallel
  const [productsResult, campaign] = await Promise.all([
    productsQuery,
    getActiveCampaign(),
  ])

  const { data: productsData, count: totalCount } = productsResult

  const variantsMap = await fetchVariantsByProductId((productsData || []).map((p: any) => p.id))

  const products = (productsData || []).map((p: any) => {
    const vm = variantsMap.get(p.id)
    const t10n = p.translations?.[locale]
    return {
      id: p.id,
      slug: p.slug,
      title: t10n?.title || p.title,
      description: t10n?.description || p.description,
      price: p.base_price_cents / 100,
      compareAtPrice: p.compare_at_price_cents ? p.compare_at_price_cents / 100 : undefined,
      currency: p.currency || 'EUR',
      rating: p.avg_rating || 0,
      reviewCount: p.review_count || 0,
      category: (p.categories as any)?.slug || 'other',
      inStock: variantsMap.has(p.id),
      createdAt: p.created_at,
      image: p.images?.[0]?.src || '',
      variants: vm,
      ...(vm?.hasVariantPricing ? { hasVariantPricing: true, maxPrice: vm.maxPrice } : {}),
    }
  })

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t('title'),
    description: t('subtitle'),
    numberOfItems: totalCount || 0,
    itemListElement: products.slice(0, 10).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        '@id': `${baseUrl}/${locale}/shop/${product.slug}`,
        name: product.title,
        description: product.description,
        image: product.image,
        offers: product.hasVariantPricing && product.maxPrice ? {
          '@type': 'AggregateOffer',
          lowPrice: product.price,
          highPrice: product.maxPrice,
          priceCurrency: product.currency,
          availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `${baseUrl}/${locale}/shop/${product.slug}`,
        } : {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: product.currency,
          availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `${baseUrl}/${locale}/shop/${product.slug}`,
        },
        aggregateRating: product.rating > 0 ? {
          '@type': 'AggregateRating',
          ratingValue: product.rating,
          reviewCount: product.reviewCount,
        } : undefined,
      },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <div className="container mx-auto max-w-7xl px-4 py-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${locale}`}>Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('title')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <ShopHeroBanner
        title={campaign?.title?.[locale] || campaign?.title?.en || t('heroFallbackTitle')}
        subtitle={campaign?.subtitle?.[locale] || campaign?.subtitle?.en || t('heroFallbackSubtitle')}
        productsLabel={t('productsAvailable', { count: totalCount || 0 })}
        heroImage={campaign?.shop_hero_image_url || campaign?.image_url || null}
        ctaText={campaign?.cta_text?.[locale] || campaign?.cta_text?.en || null}
        ctaUrl={campaign?.cta_url || null}
      />
      <ShopPageClient
        key={`shop-${sort}`}
        locale={locale}
        initialProducts={products}
        initialTotal={totalCount || 0}
        searchQuery={query}
        sort={sort}
      />
    </>
  )
}
