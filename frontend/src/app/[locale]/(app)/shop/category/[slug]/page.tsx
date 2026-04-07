import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BRAND, BASE_URL } from '@/lib/store-config'
import { sanitizeForLike } from '@/lib/query-sanitizer'
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
  slug: string
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

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

type SortOption = 'featured' | 'priceLowToHigh' | 'priceHighToLow' | 'newest' | 'topRated'

const PRODUCTS_PER_PAGE = 20

// Force dynamic — category pages use dynamic APIs incompatible with ISR
export const dynamic = 'force-dynamic'

// Pre-render known category pages at build time (fetched from DB)
export async function generateStaticParams() {
  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('slug')
    .eq('is_active', true)

  const locales = ['en', 'es', 'de']
  return (categories || []).flatMap((cat) =>
    locales.map((locale) => ({ locale, slug: cat.slug }))
  )
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: 'shop' })

  const baseUrl = BASE_URL
  const siteName = BRAND.name

  const categoryName = t.has(`category.${slug}`) ? t(`category.${slug}`) : slug

  const title = `${categoryName} - ${siteName}`
  const descriptionTemplates: Record<string, (name: string) => string> = {
    en: (name) => `Browse our collection of ${name.toLowerCase()} products. Custom print-on-demand designs delivered to your door.`,
    es: (name) => `Explora nuestra colección de productos de ${name.toLowerCase()}. Diseños personalizados de impresión bajo demanda entregados a tu puerta.`,
    de: (name) => `Entdecken Sie unsere Kollektion von ${name.toLowerCase()}-Produkten. Individuelle Print-on-Demand-Designs direkt zu Ihnen nach Hause geliefert.`,
  }
  const description = (descriptionTemplates[locale] || descriptionTemplates.en)(categoryName)

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
        'x-default': `${baseUrl}/en/shop/category/${slug}`,
      },
    },
  }
}

// Server Component - fetches data and renders
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, slug } = await params
  const search = await searchParams

  // Validate locale for name field
  const validLocales = ['en', 'es', 'de']
  const normalizedLocale = validLocales.includes(locale) ? locale : 'en'
  const nameField = `name_${normalizedLocale}` as 'name_en' | 'name_es' | 'name_de'

  // Validate category exists in DB (replaces hardcoded VALID_CATEGORIES)
  const { data: categoryRow } = await supabaseAdmin
    .from('categories')
    .select('id, slug, parent_id, name_en, name_es, name_de, icon, image_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!categoryRow) notFound()

  const categoryName = categoryRow[nameField] || categoryRow.name_en
  const isParent = !categoryRow.parent_id

  // Extract search parameters
  const query = search.q as string | undefined
  const sort = (search.sort as SortOption) || 'featured'
  const selectedSub = search.sub as string | undefined

  // Determine category IDs to fetch products from
  let categoryIds: string[] = [categoryRow.id]
  let subcategories: Array<{ slug: string; name: string; productCount: number }> = []
  let parentInfo: { slug: string; name: string } | null = null

  if (isParent) {
    // Fetch children for subcategory chips
    const { data: children } = await supabaseAdmin
      .from('categories')
      .select('id, slug, name_en, name_es, name_de')
      .eq('parent_id', categoryRow.id)
      .eq('is_active', true)
      .order('sort_order')

    const childList = children || []
    categoryIds = [categoryRow.id, ...childList.map(c => c.id)]

    // If a subcategory is selected, filter to just that one
    if (selectedSub) {
      const subCat = childList.find(c => c.slug === selectedSub)
      if (subCat) {
        categoryIds = [subCat.id]
      }
    }

    // Count products per subcategory for chips
    if (childList.length > 0) {
      const { data: subCounts } = await supabaseAdmin
        .from('products')
        .select('category_id')
        .eq('status', 'active')
        .in('category_id', childList.map(c => c.id))

      const subCountMap = new Map<string, number>()
      for (const p of subCounts || []) {
        if (p.category_id) {
          subCountMap.set(p.category_id, (subCountMap.get(p.category_id) || 0) + 1)
        }
      }

      subcategories = childList
        .map(c => ({
          slug: c.slug,
          name: c[nameField] || c.name_en,
          productCount: subCountMap.get(c.id) || 0,
        }))
        .filter(s => s.productCount > 0)
    }
  } else {
    // Child category — fetch parent info for breadcrumb
    const { data: parent } = await supabaseAdmin
      .from('categories')
      .select('slug, name_en, name_es, name_de')
      .eq('id', categoryRow.parent_id)
      .single()

    if (parent) {
      parentInfo = {
        slug: parent.slug,
        name: parent[nameField] || parent.name_en,
      }
    }
  }

  // Build products query
  let productsQuery = supabaseAdmin
    .from('products')
    .select('id, slug, title, description, base_price_cents, currency, avg_rating, review_count, category_id, categories(slug), status, created_at, images', { count: 'exact' })
    .eq('status', 'active')
    .is('deleted_at', null)
    .in('category_id', categoryIds)

  if (query && query.trim()) {
    const safeQuery = sanitizeForLike(query, 'both')
    productsQuery = productsQuery.or(`title.ilike.${safeQuery},description.ilike.${safeQuery}`)
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

  productsQuery = productsQuery.range(0, PRODUCTS_PER_PAGE - 1)

  const { data: productsData, count: totalCount } = await productsQuery

  // Batch-fetch variants
  const variantsMap = await fetchVariantsByProductId((productsData || []).map((p: any) => p.id))

  // Transform products for client component
  const products = (productsData || []).map((p: Product) => {
    const vm = variantsMap.get(p.id)
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      price: p.base_price_cents / 100,
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

  // Get translations for JSON-LD
  const t = await getTranslations({ locale, namespace: 'shop' })
  const baseUrl = BASE_URL
  const siteName = BRAND.name

  // JSON-LD structured data
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
                <Link href={`/${locale}/shop`}>{t('title')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {parentInfo && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={`/${locale}/shop/category/${parentInfo.slug}`}>
                      {parentInfo.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{categoryName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <ShopPageClient
        key={`${slug}-${selectedSub || 'all'}-${sort}`}
        locale={locale}
        initialProducts={products}
        initialTotal={totalCount || 0}
        searchQuery={query}
        sort={sort}
        categorySlug={selectedSub || slug}
      />
    </>
  )
}
