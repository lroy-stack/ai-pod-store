import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductDetailClient } from '@/components/products/ProductDetailClient'
import { getProduct, getProductReviews, getRelatedProducts } from '@/lib/product-detail-cache'

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}): Promise<Metadata> {
  const { id, locale } = await params
  const product = await getProduct(id)

  if (!product) {
    return {
      title: 'Product Not Found | POD AI Store',
      description: 'The product you are looking for could not be found.',
    }
  }

  const title = `${product.title} - €${product.price} | POD AI Store`
  const description = product.description || `Buy ${product.title} at POD AI Store`
  const images = product.images && product.images.length > 0 ? [product.images[0]] : []

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const productPath = `/shop/${id}`

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
      type: 'website',
      locale: locale,
      alternateLocale: ['en', 'es', 'de'].filter(l => l !== locale),
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
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  const product = await getProduct(id)

  if (!product) {
    notFound()
  }

  const relatedProducts = await getRelatedProducts(id)
  const reviews = await getProductReviews(id)

  // Generate JSON-LD structured data for SEO
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const jsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: product.images,
    sku: product.id,
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/${locale}/shop/${id}`,
      priceCurrency: product.currency || 'EUR',
      price: product.price,
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'POD AI Store',
      },
    },
    aggregateRating: product.reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    } : undefined,
  } : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetailClient product={product} relatedProducts={relatedProducts} reviews={reviews} />
    </>
  )
}
