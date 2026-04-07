import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductDetailClient } from '@/components/products/ProductDetailClient'
import { getProduct, getProductReviews, getRelatedProducts } from '@/lib/product-detail-cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BASE_URL, BRAND, STORE_DEFAULTS } from '@/lib/store-config'

// Force dynamic rendering — product pages use dynamic APIs (cookies, headers)
// that conflict with ISR's static generation
export const dynamic = 'force-dynamic'

// Pre-render top products at build time (3 locales x 50 products = 150 pages)
export async function generateStaticParams() {
  const { data } = await supabaseAdmin
    .from('products')
    .select('slug')
    .eq('status', 'active')
    .order('review_count', { ascending: false })
    .limit(50)

  const locales = ['en', 'es', 'de']
  return (data || []).flatMap((p) =>
    locales.map((locale) => ({ locale, slug: p.slug }))
  )
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>
}): Promise<Metadata> {
  const { slug, locale } = await params
  const product = await getProduct(slug, locale)

  if (!product) {
    return {
      title: `Product Not Found | ${STORE_DEFAULTS.storeName}`,
      description: 'The product you are looking for could not be found.',
    }
  }

  const title = product.hasVariantPricing
    ? `${product.title} - from €${product.price} | ${STORE_DEFAULTS.storeName}`
    : `${product.title} - €${product.price} | ${STORE_DEFAULTS.storeName}`
  const description = product.description || `Buy ${product.title} at ${STORE_DEFAULTS.storeName}`
  const images = product.images && product.images.length > 0 ? [product.images[0]] : []

  const baseUrl = BASE_URL
  const productPath = `/shop/${slug}`

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/${locale}${productPath}`,
      languages: {
        'en': `${baseUrl}/en${productPath}`,
        'es': `${baseUrl}/es${productPath}`,
        'de': `${baseUrl}/de${productPath}`,
        'x-default': `${baseUrl}/en${productPath}`,
      },
    },
    openGraph: {
      title,
      description,
      images,
      type: 'article',
      locale: locale,
      alternateLocale: ['en', 'es', 'de'].filter(l => l !== locale),
    },
    other: {
      'product:price:amount': String(product.price),
      'product:price:currency': product.currency || 'EUR',
      'product:availability': 'in stock',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>
}) {
  const { slug, locale } = await params
  const product = await getProduct(slug, locale)

  if (!product) {
    notFound()
  }

  const relatedProducts = await getRelatedProducts(product.id)
  const reviews = await getProductReviews(product.id)

  // Generate JSON-LD structured data for SEO
  const baseUrl = BASE_URL
  const productJsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: product.images,
    sku: product.id,
    brand: {
      '@type': 'Brand',
      name: BRAND.name,
    },
    offers: product.hasVariantPricing && product.maxPrice ? {
      '@type': 'AggregateOffer',
      url: `${baseUrl}/${locale}/shop/${slug}`,
      priceCurrency: product.currency || 'EUR',
      lowPrice: product.price,
      highPrice: product.maxPrice,
      offerCount: product.variants?.sizes?.length || 1,
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: STORE_DEFAULTS.storeName,
      },
    } : {
      '@type': 'Offer',
      url: `${baseUrl}/${locale}/shop/${slug}`,
      priceCurrency: product.currency || 'EUR',
      price: product.price,
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: STORE_DEFAULTS.storeName,
      },
    },
    aggregateRating: product.reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    } : undefined,
  } : null

  // Generate BreadcrumbList structured data
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${baseUrl}/${locale}`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Shop',
      item: `${baseUrl}/${locale}/shop`,
    },
  ]

  // Add product as final breadcrumb item
  breadcrumbItems.push({
    '@type': 'ListItem',
    position: breadcrumbItems.length + 1,
    name: product?.title || 'Product',
    item: `${baseUrl}/${locale}/shop/${slug}`,
  })

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  }

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductDetailClient product={product} relatedProducts={relatedProducts} reviews={reviews} />
    </>
  )
}
