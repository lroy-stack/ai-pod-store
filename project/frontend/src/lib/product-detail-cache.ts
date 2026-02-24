import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Build variant → image indices map by matching printify_variant_id in image URLs.
 * Printify mockup URLs contain the variant ID: /mockup/{product_id}/{variant_id}/{image_id}/...
 *
 * @param field - 'color' or 'size' — the variant dimension to group by
 */
function buildVariantImageMap(
  images: string[],
  variants: Array<{ color: string | null; size: string | null; printify_variant_id: string | null }>,
  field: 'color' | 'size',
): Record<string, number[]> {
  const variantIdToValue = new Map<string, string>()
  for (const v of variants) {
    const value = v[field]
    if (value && v.printify_variant_id) {
      variantIdToValue.set(v.printify_variant_id, value)
    }
  }

  const indices: Record<string, number[]> = {}
  for (let i = 0; i < images.length; i++) {
    const url = images[i]
    for (const [pvid, value] of variantIdToValue) {
      if (url.includes('/' + pvid + '/')) {
        if (!indices[value]) indices[value] = []
        // Avoid duplicates (multiple variants of same color/size point to same image)
        if (!indices[value].includes(i)) indices[value].push(i)
        break
      }
    }
  }

  return indices
}

// Fetch product by ID from Supabase
export async function getProduct(id: string) {
  const [productResult, variantsResult, allEnabledResult] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .single(),
    supabaseAdmin
      .from('product_variants')
      .select('size, color, price_cents, is_enabled, is_available, image_url, printify_variant_id')
      .eq('product_id', id)
      .eq('is_enabled', true)
      .eq('is_available', true),
    supabaseAdmin
      .from('product_variants')
      .select('size, color, is_available, printify_variant_id')
      .eq('product_id', id)
      .eq('is_enabled', true),
  ])

  const { data: product, error } = productResult
  if (error || !product) {
    return null
  }

  const variants = variantsResult.data || []
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[]
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[]

  const allImages: string[] = Array.isArray(product.images)
    ? product.images.map((img: { src?: string; url?: string }) => img.src || img.url || '').filter(Boolean)
    : []

  // Build variant→image indices maps (only when multiple options exist per dimension)
  const colorImageIndices = colors.length > 1
    ? buildVariantImageMap(allImages, variants, 'color')
    : {}
  const sizeImageIndices = sizes.length > 1
    ? buildVariantImageMap(allImages, variants, 'size')
    : {}

  const details = product.product_details || {}

  // Build unavailable combinations from all enabled variants
  const allEnabled = allEnabledResult.data || []
  const allEnabledColors = [...new Set(allEnabled.map(v => v.color).filter(Boolean))] as string[]
  const allEnabledSizes = [...new Set(allEnabled.map(v => v.size).filter(Boolean))] as string[]
  const unavailableCombinations = allEnabled
    .filter(v => !v.is_available)
    .map(v => ({ color: v.color || '', size: v.size || '' }))

  return {
    id: product.id,
    title: product.title,
    description: product.description,
    longDescription: product.description,
    price: product.base_price_cents / 100,
    currency: product.currency?.toUpperCase() || 'EUR',
    images: allImages,
    rating: Number(product.avg_rating) || 0,
    reviewCount: product.review_count || 0,
    category: product.category?.toLowerCase(),
    tags: product.tags || [],
    inStock: variants.length > 0,
    printifyId: product.printify_id,
    createdAt: product.created_at,
    materials: details.material || null,
    careInstructions: details.care_instructions || null,
    printTechnique: details.print_technique || null,
    manufacturingCountry: details.manufacturing_country || null,
    brand: details.brand || null,
    safetyInformation: details.safety_information || null,
    productDetails: details,
    variants: {
      ...(sizes.length > 0 ? { sizes } : {}),
      ...(colors.length > 0 ? { colors } : {}),
      ...(Object.keys(colorImageIndices).length > 0 ? { colorImageIndices } : {}),
      ...(Object.keys(sizeImageIndices).length > 0 ? { sizeImageIndices } : {}),
      ...(allEnabledColors.length > 0 ? { allColors: allEnabledColors } : {}),
      ...(allEnabledSizes.length > 0 ? { allSizes: allEnabledSizes } : {}),
      ...(unavailableCombinations.length > 0 ? { unavailableCombinations } : {}),
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

// Fetch related products using co-purchase analysis from association_rules
export async function getRelatedProducts(productId: string) {
  // First, try to get recommendations from association rules (co-purchase data)
  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('association_rules')
    .select('consequents, confidence, lift')
    .contains('antecedents', [productId])
    .order('lift', { ascending: false })
    .limit(4)

  let recommendedIds: string[] = []

  if (!rulesError && rules && rules.length > 0) {
    // Extract all consequent product IDs and flatten
    for (const rule of rules) {
      if (rule.consequents && Array.isArray(rule.consequents)) {
        recommendedIds.push(...rule.consequents)
      }
    }
    // Remove duplicates and limit to 4
    recommendedIds = [...new Set(recommendedIds)].slice(0, 4)
  }

  // If we have co-purchase recommendations, fetch those products
  if (recommendedIds.length > 0) {
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, title, description, category, base_price_cents, currency, images, avg_rating, review_count')
      .eq('status', 'active')
      .in('id', recommendedIds)

    if (!productsError && products && products.length > 0) {
      return products.map((p) => ({
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
  }

  // Fallback: Use category-based recommendations if no association rules exist
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
