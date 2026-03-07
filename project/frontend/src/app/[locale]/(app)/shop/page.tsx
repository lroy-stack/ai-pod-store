import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BRAND, BASE_URL } from '@/lib/store-config'
import Link from 'next/link'
import { ShopPageClient } from '@/components/shop/ShopPageClient'
import { ShopCategoryLanding } from '@/components/shop/ShopCategoryLanding'
import { getCachedCategoryCounts, setCachedCategoryCounts, getCachedCategoryTree, setCachedCategoryTree } from '@/lib/cached-queries'
import { sanitizeForLike } from '@/lib/query-sanitizer'
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

/** Fetch hierarchical category tree with preview images (cached) */
async function getCategoryTree(locale: string) {
  const validLocales = ['en', 'es', 'de']
  const normalizedLocale = validLocales.includes(locale) ? locale : 'en'
  const nameField = `name_${normalizedLocale}` as 'name_en' | 'name_es' | 'name_de'

  // Check cache
  const cached = await getCachedCategoryTree()
  if (cached) {
    return (cached as any[]).map((cat: any) => ({
      ...cat,
      name: cat[nameField] || cat.name_en,
    }))
  }

  // Fetch all active categories
  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('id, slug, parent_id, name_en, name_es, name_de, icon, image_url, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (!categories || categories.length === 0) return []

  // Fetch product counts by category_id
  const { data: productCounts } = await supabaseAdmin
    .from('products')
    .select('category_id')
    .eq('status', 'active')
    .not('category_id', 'is', null)

  // Build count map
  const countMap = new Map<string, number>()
  for (const p of productCounts || []) {
    if (p.category_id) {
      countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1)
    }
  }

  // Build parent->children map
  const parents = categories.filter(c => !c.parent_id)
  const childrenByParent = new Map<string, typeof categories>()
  for (const c of categories) {
    if (c.parent_id) {
      const list = childrenByParent.get(c.parent_id) || []
      list.push(c)
      childrenByParent.set(c.parent_id, list)
    }
  }

  // For each parent, calculate total count and fetch 3 preview images
  const tree = await Promise.all(parents.map(async (parent) => {
    const children = childrenByParent.get(parent.id) || []
    const allCategoryIds = [parent.id, ...children.map(c => c.id)]
    const ownCount = countMap.get(parent.id) || 0
    const childCount = children.reduce((s, c) => s + (countMap.get(c.id) || 0), 0)
    const totalCount = ownCount + childCount

    // Fetch 3 preview product images
    const { data: previewProducts } = await supabaseAdmin
      .from('products')
      .select('images')
      .in('category_id', allCategoryIds)
      .eq('status', 'active')
      .order('avg_rating', { ascending: false })
      .limit(3)

    const previewImages = (previewProducts || [])
      .map((p: any) => p.images?.[0]?.src)
      .filter(Boolean) as string[]

    return {
      slug: parent.slug,
      name_en: parent.name_en,
      name_es: parent.name_es,
      name_de: parent.name_de,
      imageUrl: parent.image_url,
      totalProductCount: totalCount,
      previewImages,
    }
  }))

  // Cache the raw tree (locale-independent)
  await setCachedCategoryTree(tree)

  // Return localized
  return tree.map(cat => ({
    ...cat,
    name: cat[nameField] || cat.name_en,
  }))
}

interface ShopPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

type SortOption = 'featured' | 'priceLowToHigh' | 'priceHighToLow' | 'newest' | 'topRated'

const PRODUCTS_PER_PAGE = 20

// ISR: revalidate shop page every 5 minutes (matches category tree Redis TTL)
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

  // ── Category Landing Mode (no search query) ──
  if (!isSearchMode) {
    const categoryTree = await getCategoryTree(locale)
    const visibleCategories = categoryTree.filter(c => c.totalProductCount > 0)

    // Count total products across all categories
    const totalProducts = visibleCategories.reduce((sum, c) => sum + c.totalProductCount, 0)

    // JSON-LD for category landing
    const categoryListSchema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: t('title'),
      description: t('subtitle'),
      url: `${baseUrl}/${locale}/shop`,
    }

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryListSchema) }}
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
        <ShopCategoryLanding
          locale={locale}
          categories={visibleCategories.map(c => ({
            slug: c.slug,
            name: c.name,
            imageUrl: c.imageUrl,
            productCount: c.totalProductCount,
            previewImages: c.previewImages,
          }))}
          totalProducts={totalProducts}
        />
      </>
    )
  }

  // ── Search Results Mode ──
  const category = (search.category as string) || 'all'
  const sort = (search.sort as SortOption) || 'featured'
  const newArrivals = search.newArrivals === 'true'

  let productsQuery = supabaseAdmin
    .from('products')
    .select('id, title, description, base_price_cents, currency, avg_rating, review_count, category_id, categories(slug), status, created_at, images', { count: 'exact' })
    .eq('status', 'active')
    .is('deleted_at', null)

  if (category && category !== 'all') {
    // Resolve slug → category_id(s) for proper DB filtering
    const { data: catRow } = await supabaseAdmin
      .from('categories')
      .select('id, parent_id')
      .eq('slug', category)
      .eq('is_active', true)
      .single()
    if (catRow) {
      let catIds = [catRow.id]
      if (!catRow.parent_id) {
        const { data: children } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('parent_id', catRow.id)
          .eq('is_active', true)
        catIds = [catRow.id, ...(children || []).map((c: any) => c.id)]
      }
      productsQuery = productsQuery.in('category_id', catIds)
    }
  }

  const safeQuery = sanitizeForLike(query, 'both')
  productsQuery = productsQuery.or(`title.ilike.${safeQuery},description.ilike.${safeQuery}`)

  if (newArrivals) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    productsQuery = productsQuery.gte('created_at', thirtyDaysAgo.toISOString())
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

  const cachedCounts = await getCachedCategoryCounts()

  const [productsResult, categoriesResult] = await Promise.all([
    productsQuery,
    cachedCounts
      ? Promise.resolve({ data: null })
      : supabaseAdmin.from('products').select('category_id, categories(slug)').eq('status', 'active'),
  ])

  const { data: productsData, count: totalCount } = productsResult

  let categoryCounts: Record<string, number>
  if (cachedCounts) {
    categoryCounts = { ...cachedCounts, all: totalCount || 0 }
  } else {
    const { data: allProductsData } = categoriesResult
    categoryCounts = { all: totalCount || 0 }
    if (allProductsData) {
      for (const p of allProductsData) {
        const cat = (p.categories as any)?.slug || 'other'
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
      }
    }
    setCachedCategoryCounts(categoryCounts)
  }

  const categories = ['all', ...Object.keys(categoryCounts).filter(c => c !== 'all')]

  const variantsMap = await fetchVariantsByProductId((productsData || []).map((p: any) => p.id))

  const products = (productsData || []).map((p: Product) => {
    const vm = variantsMap.get(p.id)
    return {
      id: p.id,
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
        '@id': `${baseUrl}/${locale}/shop/${product.id}`,
        name: product.title,
        description: product.description,
        image: product.image,
        offers: product.hasVariantPricing && product.maxPrice ? {
          '@type': 'AggregateOffer',
          lowPrice: product.price,
          highPrice: product.maxPrice,
          priceCurrency: product.currency,
          availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `${baseUrl}/${locale}/shop/${product.id}`,
        } : {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: product.currency,
          availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `${baseUrl}/${locale}/shop/${product.id}`,
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
      <ShopPageClient
        key={`shop-${category}-${sort}`}
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
