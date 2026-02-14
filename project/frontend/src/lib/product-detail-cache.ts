import { supabaseAdmin } from '@/lib/supabase-admin'

// Fetch product by ID from Supabase
export async function getProduct(id: string) {
  const [productResult, variantsResult] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .single(),
    supabaseAdmin
      .from('product_variants')
      .select('size, color, price_cents, is_enabled, is_available')
      .eq('product_id', id)
      .eq('is_enabled', true)
      .eq('is_available', true),
  ])

  const { data: product, error } = productResult
  if (error || !product) {
    return null
  }

  const variants = variantsResult.data || []
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[]
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[]

  return {
    id: product.id,
    title: product.title,
    description: product.description,
    longDescription: product.description,
    price: product.base_price_cents / 100,
    currency: product.currency?.toUpperCase() || 'EUR',
    images: Array.isArray(product.images) ? product.images.map((img: { src?: string; url?: string; alt?: string }) => img.src || img.url || '') : [],
    rating: Number(product.avg_rating) || 0,
    reviewCount: product.review_count || 0,
    category: product.category?.toLowerCase(),
    tags: product.tags || [],
    inStock: true,
    printifyId: product.printify_id,
    createdAt: product.created_at,
    variants: {
      ...(sizes.length > 0 ? { sizes } : {}),
      ...(colors.length > 0 ? { colors } : {}),
    },
  }
}

// Fetch product reviews from Supabase
export async function getProductReviews(productId: string) {
  const { data: reviews, error } = await supabaseAdmin
    .from('product_reviews')
    .select('id, rating, title, body, is_verified_purchase, created_at, user_id')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !reviews) {
    return []
  }

  return reviews.map((r) => ({
    id: r.id,
    author: 'Verified Buyer',
    rating: r.rating,
    date: r.created_at,
    verified: r.is_verified_purchase,
    comment: r.body || r.title || '',
  }))
}

// Fetch related products (same category, excluding current)
export async function getRelatedProducts(productId: string) {
  const product = await getProduct(productId)
  if (!product) return []

  const { data: related, error } = await supabaseAdmin
    .from('products')
    .select('id, title, description, category, base_price_cents, currency, images, avg_rating, review_count')
    .eq('status', 'active')
    .ilike('category', product.category)
    .neq('id', productId)
    .limit(4)

  if (error || !related) {
    return []
  }

  return related.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.base_price_cents / 100,
    currency: p.currency?.toUpperCase() || 'EUR',
    image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : null,
    rating: Number(p.avg_rating) || 0,
    reviewCount: p.review_count || 0,
    category: p.category?.toLowerCase(),
  }))
}
