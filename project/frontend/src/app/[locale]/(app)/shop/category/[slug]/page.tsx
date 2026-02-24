import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
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

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

type SortOption = 'featured' | 'priceLowToHigh' | 'priceHighToLow' | 'newest' | 'topRated'

const PRODUCTS_PER_PAGE = 20

// Valid category slugs (from translations)
const VALID_CATEGORIES = [
  'apparel',
  'home-decor',
  'drinkware',
  'accessories',
  't-shirts',
  'hoodies',
  'stickers',
  'phone-cases',
  'posters',
  'bags',
  'hats',
  'mugs',
  'wall-art',
  'stationery',
  'sweatshirts',
  'kitchen',
  'kids',
  'games',
]

// Server Component - generates metadata for SEO
export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: 'shop' })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Skapara'

  // Get category name from translations
  const categoryName = t.has(`category.${slug}`) ? t(`category.${slug}`) : slug

  const title = `${categoryName} - ${siteName}`
  const description = `Browse our collection of ${categoryName.toLowerCase()} products. Custom print-on-demand designs delivered to your door.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/shop/category/${slug}`,
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
      canonical: `${baseUrl}/${locale}/shop/category/${slug}`,
      languages: {
        'en': `${baseUrl}/en/shop/category/${slug}`,
        'es': `${baseUrl}/es/shop/category/${slug}`,
        'de': `${baseUrl}/de/shop/category/${slug}`,
      },
    },
  }
}

// Server Component - fetches data and renders
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, slug } = await params
  const search = await searchParams

  // Validate category slug
  if (!VALID_CATEGORIES.includes(slug)) {
    notFound()
  }

  // Extract search parameters
  const query = search.q as string | undefined
  const sort = (search.sort as SortOption) || 'featured'
  const newArrivals = search.newArrivals === 'true'

  // Build query - filter by category slug (service key bypasses RLS — safe in Server Components)
  let productsQuery = supabaseAdmin
    .from('products')
    .select('id, title, description, base_price_cents, currency, avg_rating, review_count, category_id, categories(slug), status, created_at, images', { count: 'exact' })
    .eq('status', 'active')
    .eq('categories.slug', slug)

  // Apply search filter if provided
  if (query && query.trim()) {
    productsQuery = productsQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
  }

  // Apply new arrivals filter if enabled
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
  const categoryCounts: Record<string, number> = { all: 0 }
  if (allProductsData) {
    categoryCounts.all = allProductsData.length
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

  // Get translations for JSON-LD and UI
  const t = await getTranslations({ locale, namespace: 'shop' })
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Skapara'

  // Get category name from translations
  const categoryName = t.has(`category.${slug}`) ? t(`category.${slug}`) : slug

  // JSON-LD structured data for SEO - ItemList schema
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${categoryName} Products`,
    description: `Browse our collection of ${categoryName.toLowerCase()} products`,
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
              <BreadcrumbLink asChild>
                <Link href={`/${locale}/shop`}>Shop</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{categoryName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Shop page content */}
      <ShopPageClient
        locale={locale}
        initialProducts={products}
        initialTotal={totalCount || 0}
        initialCategories={categories}
        initialCategoryCounts={categoryCounts}
        searchQuery={query}
        category={slug}
        sort={sort}
      />
    </>
  )
}
