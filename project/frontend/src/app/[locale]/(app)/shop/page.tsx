import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { ShopPageClient } from '@/components/shop/ShopPageClient'
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
  if (productIds.length === 0) return new Map<string, { sizes: string[]; colors: string[]; colorImages: Record<string, string> }>()

  const { data: allVariants } = await supabaseAdmin
    .from('product_variants')
    .select('product_id, size, color, image_url')
    .in('product_id', productIds)
    .eq('is_enabled', true)
    .eq('is_available', true)

  const grouped = new Map<string, { sizes: Set<string>; colors: Set<string>; colorImages: Map<string, string> }>()
  for (const v of allVariants || []) {
    if (!grouped.has(v.product_id)) {
      grouped.set(v.product_id, { sizes: new Set(), colors: new Set(), colorImages: new Map() })
    }
    const entry = grouped.get(v.product_id)!
    if (v.size) entry.sizes.add(v.size)
    if (v.color) {
      entry.colors.add(v.color)
      if (v.image_url && !entry.colorImages.has(v.color)) {
        entry.colorImages.set(v.color, v.image_url)
      }
    }
  }

  const result = new Map<string, { sizes: string[]; colors: string[]; colorImages: Record<string, string> }>()
  for (const [id, { sizes, colors, colorImages }] of grouped) {
    result.set(id, {
      sizes: [...sizes],
      colors: [...colors],
      colorImages: Object.fromEntries(colorImages),
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

// Server Component - generates metadata for SEO
export async function generateMetadata({ params, searchParams }: ShopPageProps): Promise<Metadata> {
  const { locale } = await params
  const search = await searchParams
  const t = await getTranslations({ locale, namespace: 'shop' })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Skapara'

  const query = search.q as string | undefined
  const category = search.category as string | undefined

  let title = `${t('title')} - ${siteName}`
  let description = t('subtitle')

  if (query) {
    title = `Search: ${query} - ${siteName}`
    description = `Search results for "${query}" in our custom print-on-demand products`
  } else if (category && category !== 'all') {
    const categoryName = t.has(`category.${category}`) ? t(`category.${category}`) : category
    title = `${categoryName} - ${siteName}`
    description = `Browse our collection of ${categoryName} products`
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
      },
    },
  }
}

// Server Component - fetches data and renders
export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { locale } = await params
  const search = await searchParams

  // Extract search parameters
  const query = search.q as string | undefined
  const category = (search.category as string) || 'all'
  const sort = (search.sort as SortOption) || 'featured'
  const newArrivals = search.newArrivals === 'true'

  // Fetch products on the server (service key bypasses RLS — safe in Server Components)
  let productsQuery = supabaseAdmin
    .from('products')
    .select('id, title, description, base_price_cents, currency, avg_rating, review_count, category_id, categories(slug), status, created_at, images', { count: 'exact' })
    .eq('status', 'active')

  // Apply filters
  if (category && category !== 'all') {
    productsQuery = productsQuery.eq('categories.slug', category)
  }

  if (query && query.trim()) {
    productsQuery = productsQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
  }

  if (newArrivals) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    productsQuery = productsQuery.gte('created_at', thirtyDaysAgo.toISOString())
  }

  // Apply sorting
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

  // Paginate
  productsQuery = productsQuery.range(0, PRODUCTS_PER_PAGE - 1)

  const { data: productsData, count: totalCount } = await productsQuery

  // Fetch all categories for filters (JOIN with categories table for slug)
  const { data: allProductsData } = await supabaseAdmin
    .from('products')
    .select('category_id, categories(slug)')
    .eq('status', 'active')

  // Calculate category counts
  const categoryCounts: Record<string, number> = { all: totalCount || 0 }
  if (allProductsData) {
    for (const p of allProductsData) {
      const cat = (p.categories as any)?.slug || 'other'
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    }
  }

  const categories = ['all', ...Object.keys(categoryCounts).filter(c => c !== 'all')]

  // Batch-fetch variants from product_variants table (same pattern as /api/products)
  const variantsMap = await fetchVariantsByProductId((productsData || []).map((p: any) => p.id))

  // Transform products for client component
  const products = (productsData || []).map((p: Product) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.base_price_cents / 100, // Convert cents to currency units
    currency: p.currency || 'EUR',
    rating: p.avg_rating || 0,
    reviewCount: p.review_count || 0,
    category: (p.categories as any)?.slug || 'other',
    inStock: p.status === 'active',
    createdAt: p.created_at,
    image: p.images?.[0]?.src || '',
    variants: variantsMap.get(p.id),
  }))

  // Get translations for JSON-LD
  const t = await getTranslations({ locale, namespace: 'shop' })
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Skapara'

  // JSON-LD structured data for SEO - ItemList schema
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
        '@id': `${baseUrl}/${locale}/products/${product.id}`,
        name: product.title,
        description: product.description,
        image: product.image,
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: product.currency,
          availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `${baseUrl}/${locale}/products/${product.id}`,
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
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      {/* Breadcrumbs */}
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
              <BreadcrumbPage>Shop</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <ShopPageClient
        locale={locale}
        initialProducts={products}
        initialTotal={totalCount || 0}
        initialCategories={categories}
        initialCategoryCounts={categoryCounts}
        searchQuery={query}
        category={category}
        sort={sort}
      />
    </>
  )
}
