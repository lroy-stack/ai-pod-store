import { supabaseAdmin } from '@/lib/supabase-admin'

// Cached function to get all active products from Supabase
export async function getCatalogProducts() {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, title, description, category, tags, base_price_cents, currency, images, avg_rating, review_count, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching catalog products:', error)
    return []
  }

  return (products || []).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.base_price_cents / 100,
    currency: p.currency?.toUpperCase() || 'EUR',
    image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : null,
    rating: Number(p.avg_rating) || 0,
    reviewCount: p.review_count || 0,
    category: p.category?.toLowerCase(),
    createdAt: p.created_at,
  }))
}

// Cached function to get product categories
export async function getProductCategories() {
  const products = await getCatalogProducts()
  const categories = Array.from(new Set(products.map((p) => p.category)))
  return ['all', ...categories]
}

// Cached function to get product count per category
export async function getCategoryProductCount(category: string) {
  const products = await getCatalogProducts()
  if (category === 'all') {
    return products.length
  }
  return products.filter((p) => p.category === category).length
}
