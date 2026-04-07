import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { extractImageUrl } from '@/lib/product-cache'
import { getCachedProductDetail, setCachedProductDetail, getCachedRelatedProducts, setCachedRelatedProducts } from '@/lib/cached-queries'
import { sortSizes } from '@/lib/size-order'

/**
 * Build variant → image indices map.
 * Strategy 1: Match external_variant_id in image URLs
 * Strategy 2: Match by variant image_url + alt text
 *
 * @param field - 'color' or 'size' — the variant dimension to group by
 */
function buildVariantImageMap(
  images: string[],
  imageAlts: string[],
  variants: Array<{ color: string | null; size: string | null; external_variant_id?: string | null; image_url?: string | null }>,
  field: 'color' | 'size',
): Record<string, number[]> {
  const variantIdToValue = new Map<string, string>()
  for (const v of variants) {
    const value = v[field]
    const vid = v.external_variant_id
    if (value && vid) {
      variantIdToValue.set(vid, value)
    }
  }

  const indices: Record<string, number[]> = {}

  // Strategy 1: Match variant ID in image URLs
  for (let i = 0; i < images.length; i++) {
    const url = images[i]
    for (const [pvid, value] of variantIdToValue) {
      if (url.includes('/' + pvid + '/')) {
        if (!indices[value]) indices[value] = []
        if (!indices[value].includes(i)) indices[value].push(i)
        break
      }
    }
  }

  // Strategy 2: If no matches via URL, use image_url + alt text matching
  if (Object.keys(indices).length === 0) {
    const fieldValues = new Set<string>()
    const valueToImageUrls = new Map<string, Set<string>>()
    for (const v of variants) {
      const val = v[field]
      if (val) {
        fieldValues.add(val)
        if (v.image_url) {
          if (!valueToImageUrls.has(val)) valueToImageUrls.set(val, new Set())
          valueToImageUrls.get(val)!.add(v.image_url)
        }
      }
    }
    // Strip query params for URL comparison (timestamps may differ)
    const stripQs = (url: string) => url.split('?')[0]
    for (let i = 0; i < images.length; i++) {
      // Direct URL match (ignoring query string)
      const imgBase = stripQs(images[i])
      for (const [val, urls] of valueToImageUrls) {
        const match = [...urls].some(u => stripQs(u) === imgBase)
        if (match) {
          if (!indices[val]) indices[val] = []
          if (!indices[val].includes(i)) indices[val].push(i)
        }
      }
      // Alt text match: "Title - Color" or "Title - Color - Sleeve" pattern (skip blank images)
      // Use exact boundary matching to prevent "Black" matching inside "Vintage Black"
      const alt = imageAlts[i] || ''
      if (alt && !alt.includes('(blank)')) {
        for (const val of fieldValues) {
          const pattern = new RegExp(`- ${val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$| - )`)
          if (pattern.test(alt)) {
            if (!indices[val]) indices[val] = []
            if (!indices[val].includes(i)) indices[val].push(i)
          }
        }
      }
    }
  }

  return indices
}

// Fetch product by slug — Redis cache (cross-request) + React.cache (same-request dedup)
export const getProduct = cache(async function getProduct(slug: string, locale?: string) {
  // Check Redis cache first (returns null if Redis unavailable or miss)
  const cached = await getCachedProductDetail(slug)
  if (cached) return cached

  // Lookup product by slug (public URL identifier)
  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single()

  if (productError || !product) {
    return null
  }

  const id = product.id

  const [variantsResult, allEnabledResult] = await Promise.all([
    supabaseAdmin
      .from('product_variants')
      .select('title, size, color, price_cents, is_enabled, is_available, image_url, external_variant_id')
      .eq('product_id', id)
      .eq('is_enabled', true)
      .eq('is_available', true),
    supabaseAdmin
      .from('product_variants')
      .select('size, color, is_available, external_variant_id')
      .eq('product_id', id)
      .eq('is_enabled', true),
  ])

  const productResult = { data: product, error: null }

  const variants = variantsResult.data || []
  const sizes = sortSizes([...new Set(variants.map((v) => v.size).filter(Boolean))] as string[])
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[]

  // Build variant prices (only when prices differ across variants)
  const variantPricesRaw = variants
    .filter((v: any) => v.price_cents != null)
    .map((v: any) => ({ size: v.size || '', color: v.color || '', price: v.price_cents / 100 }))
  const uniquePrices = new Set(variantPricesRaw.map((v: any) => v.price))
  const hasVariantPricing = uniquePrices.size > 1
  const maxPriceVal = variantPricesRaw.length > 0
    ? Math.max(...variantPricesRaw.map((v: any) => v.price)) : undefined

  const rawImageObjects: Array<{ src?: string; url?: string; alt?: string }> = Array.isArray(product.images) ? product.images : []
  const allImages: string[] = rawImageObjects.map((img) => img.src || img.url || '').filter(Boolean)
  const allAlts: string[] = rawImageObjects.map((img) => img.alt || '')

  // Build variant→image indices maps (generate even for single color so thumbnail shows)
  const colorImageIndices = colors.length > 0
    ? buildVariantImageMap(allImages, allAlts, variants, 'color')
    : {}
  const sizeImageIndices = sizes.length > 1
    ? buildVariantImageMap(allImages, allAlts, variants, 'size')
    : {}

  const details = product.product_details || {}

  // Extract unique finishes from variant titles (e.g. "11oz / Black / Glossy" → "Glossy")
  const finishes = [...new Set(variants.map((v) => {
    const parts = String(v.title || '').split(' / ').map((p: string) => p.trim())
    return parts.length === 3 ? parts[2] : null
  }).filter(Boolean))] as string[]
  if (finishes.length > 0 && !details.finish) {
    details.finish = finishes.join(', ')
  }

  // Build unavailable combinations from all enabled variants
  const allEnabled = allEnabledResult.data || []
  const allEnabledColors = [...new Set(allEnabled.map(v => v.color).filter(Boolean))] as string[]
  const allEnabledSizes = sortSizes([...new Set(allEnabled.map(v => v.size).filter(Boolean))] as string[])
  const unavailableCombinations = allEnabled
    .filter(v => !v.is_available)
    .map(v => ({ color: v.color || '', size: v.size || '' }))

  const result = {
    id: product.id,
    slug: product.slug,
    title: (locale && product.translations?.[locale]?.title) || product.title,
    description: (locale && product.translations?.[locale]?.description) || product.description,
    longDescription: (locale && product.translations?.[locale]?.description) || product.description,
    price: product.base_price_cents / 100,
    ...(product.compare_at_price_cents ? { compareAtPrice: product.compare_at_price_cents / 100 } : {}),
    ...(hasVariantPricing ? { maxPrice: maxPriceVal } : {}),
    ...(hasVariantPricing ? { hasVariantPricing } : {}),
    currency: product.currency?.toUpperCase() || 'EUR',
    images: allImages,
    rating: Number(product.avg_rating) || 0,
    reviewCount: product.review_count || 0,
    category: product.category?.toLowerCase(),
    tags: product.tags || [],
    inStock: variants.length > 0,
    printifyId: product.provider_product_id,
    createdAt: product.created_at,
    materials: details.material || null,
    careInstructions: details.care_instructions || null,
    printTechnique: details.print_technique || null,
    manufacturingCountry: details.manufacturing_country || null,
    brand: details.brand || null,
    safetyInformation: details.safety_information || null,
    finish: details.finish || null,
    productDetails: details,
    variants: {
      ...(sizes.length > 0 ? { sizes } : {}),
      ...(colors.length > 0 ? { colors } : {}),
      ...(Object.keys(colorImageIndices).length > 0 ? { colorImageIndices } : {}),
      ...(Object.keys(sizeImageIndices).length > 0 ? { sizeImageIndices } : {}),
      ...(allEnabledColors.length > 0 ? { allColors: allEnabledColors } : {}),
      ...(allEnabledSizes.length > 0 ? { allSizes: allEnabledSizes } : {}),
      ...(unavailableCombinations.length > 0 ? { unavailableCombinations } : {}),
      ...(hasVariantPricing ? { prices: variantPricesRaw } : {}),
    },
  }

  // Store in Redis for cross-request caching (fire-and-forget)
  setCachedProductDetail(id, result)

  return result
})

// Fetch product reviews from Supabase (React.cache deduplicates within same request)
export const getProductReviews = cache(async function getProductReviews(productId: string) {
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
})

// Batch-fetch color variants for a set of product IDs
async function fetchColorVariants(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, { colors: string[]; colorImages: Record<string, string> }>()

  const { data: allVariants } = await supabaseAdmin
    .from('product_variants')
    .select('product_id, color, image_url')
    .in('product_id', productIds)
    .eq('is_enabled', true)
    .eq('is_available', true)

  const grouped = new Map<string, { colors: Set<string>; colorImages: Map<string, string> }>()
  for (const v of allVariants || []) {
    if (!v.color) continue
    if (!grouped.has(v.product_id)) {
      grouped.set(v.product_id, { colors: new Set(), colorImages: new Map() })
    }
    const entry = grouped.get(v.product_id)!
    entry.colors.add(v.color)
    if (v.image_url && !entry.colorImages.has(v.color)) {
      entry.colorImages.set(v.color, v.image_url)
    }
  }

  const result = new Map<string, { colors: string[]; colorImages: Record<string, string> }>()
  for (const [id, { colors, colorImages }] of grouped) {
    result.set(id, { colors: [...colors], colorImages: Object.fromEntries(colorImages) })
  }
  return result
}

// Fetch related products — Redis cache + React.cache dedup
export const getRelatedProducts = cache(async function getRelatedProducts(productId: string) {
  // Check Redis cache first
  const cachedRelated = await getCachedRelatedProducts(productId)
  if (cachedRelated) return cachedRelated

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
      .select('id, slug, title, description, category, base_price_cents, currency, images, avg_rating, review_count')
      .eq('status', 'active')
      .is('deleted_at', null)
      .in('id', recommendedIds)

    if (!productsError && products && products.length > 0) {
      const variantsMap = await fetchColorVariants(products.map((p) => p.id))
      const result = products.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        price: p.base_price_cents / 100,
        currency: p.currency?.toUpperCase() || 'EUR',
        image: extractImageUrl(p.images, 0),
        rating: Number(p.avg_rating) || 0,
        reviewCount: p.review_count || 0,
        category: p.category?.toLowerCase(),
        variants: variantsMap.has(p.id) ? variantsMap.get(p.id) : undefined,
      }))
      setCachedRelatedProducts(productId, result)
      return result
    }
  }

  // Fallback: Use category-based recommendations if no association rules exist
  const product = await getProduct(productId)
  if (!product) return []

  const { data: related, error } = await supabaseAdmin
    .from('products')
    .select('id, slug, title, description, category, base_price_cents, currency, images, avg_rating, review_count')
    .eq('status', 'active')
    .is('deleted_at', null)
    .ilike('category', product.category)
    .neq('id', productId)
    .limit(4)

  if (error || !related) {
    return []
  }

  const variantsMap = await fetchColorVariants(related.map((p) => p.id))
  const result = related.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    price: p.base_price_cents / 100,
    currency: p.currency?.toUpperCase() || 'EUR',
    image: extractImageUrl(p.images, 0),
    rating: Number(p.avg_rating) || 0,
    reviewCount: p.review_count || 0,
    category: p.category?.toLowerCase(),
    variants: variantsMap.has(p.id) ? variantsMap.get(p.id) : undefined,
  }))
  setCachedRelatedProducts(productId, result)
  return result
})
