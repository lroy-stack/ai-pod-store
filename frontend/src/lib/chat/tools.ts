import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { STORE_DEFAULTS, SHIPPING_RATES } from '@/lib/store-config'
import { generateDesign } from '@/lib/design-generation'
import type { DesignIntent } from '@/lib/providers/router'
import { checkAndIncrementUsage, decrementUsage, UserTier } from '@/lib/usage-limiter'
import { checkPromptSafety } from '@/lib/content-safety'
import { removeBackground } from '@/lib/providers/background-removal'
import { sanitizeForLike, sanitizeForPostgrest } from '@/lib/query-sanitizer'

/** Format a raw product row into the shape returned by search/browse tools */
function formatProduct(p: any) {
  return {
    id: p.id,
    title: p.title,
    description: p.description?.substring(0, 150) + (p.description?.length > 150 ? '...' : ''),
    category: (p.categories as any)?.slug || 'other',
    price: p.base_price_cents / 100,
    compareAtPrice: p.compare_at_price_cents ? p.compare_at_price_cents / 100 : undefined,
    currency: p.currency?.toUpperCase() || 'EUR',
    image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : null,
    rating: p.avg_rating || 0,
    reviewCount: p.review_count || 0,
  }
}

/** Batch-fetch product_variants and attach colorImages/sizes/colors to formatted products */
async function enrichWithVariants(supabase: SupabaseClient, products: ReturnType<typeof formatProduct>[]) {
  if (products.length === 0) return products
  const ids = products.map((p) => p.id)
  const { data: variants } = await supabase
    .from('product_variants')
    .select('product_id, size, color, image_url')
    .in('product_id', ids)
    .eq('is_enabled', true)
    .eq('is_available', true)

  if (!variants || variants.length === 0) return products

  const grouped = new Map<string, { sizes: Set<string>; colors: Set<string>; colorImages: Map<string, string> }>()
  for (const v of variants) {
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

  return products.map((p) => {
    const g = grouped.get(p.id)
    if (!g) return p
    return {
      ...p,
      variants: {
        sizes: [...g.sizes],
        colors: [...g.colors],
        colorImages: Object.fromEntries(g.colorImages),
      },
    }
  })
}

/** Fetch top-rated suggestions + available categories when a search returns 0 results */
async function getSearchFallback(supabase: SupabaseClient) {
  const [catResult, sugResult] = await Promise.all([
    supabase.from('products').select('category_id, categories(slug)').eq('status', 'active'),
    supabase
      .from('products')
      .select('id, title, description, category_id, categories(slug), base_price_cents, compare_at_price_cents, currency, images, avg_rating, review_count')
      .eq('status', 'active')
      .order('avg_rating', { ascending: false })
      .limit(4),
  ])

  const categoryCounts: Record<string, number> = {}
  for (const p of catResult.data || []) {
    const cat = (p.categories as any)?.slug || 'other'
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  }

  return {
    suggestions: (sugResult.data || []).map(formatProduct),
    availableCategories: Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
  }
}

interface ChatToolsContext {
  supabase: SupabaseClient
  chatUserId: string | null
  chatUserTier: UserTier
  chatLocale: string
  cartSessionId: string | null
  fpId: string | null
  ip: string
}

/**
 * Returns the full tools object for the chat endpoint.
 * All tools are defined here with their parameters and execute functions.
 */
export function getChatTools(ctx: ChatToolsContext) {
  const { supabase, chatUserId, chatUserTier, chatLocale, cartSessionId, fpId, ip } = ctx

  const tools = {
    product_search: tool({
      description: 'Search for products in the catalog. IMPORTANT: All product data is in English. If the user searches in another language (e.g. "camisetas", "sudaderas", "Kapuzenpullover"), translate the query to English before calling this tool.',
      parameters: z.object({
        query: z.string().describe('Search keywords in English. Use 1-2 simple words. Empty string returns all products.'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { query: string }) => {
        const { query } = args
        const limit = 8
        try {
          let dbQuery = supabase
            .from('products')
            .select('id, title, description, category_id, categories(slug), base_price_cents, compare_at_price_cents, currency, images, avg_rating, review_count')
            .eq('status', 'active')
            .limit(limit)

          // Full-text search across title and description
          // SECURITY: Sanitize user input to prevent SQL injection
          if (query) {
            const sanitizedQuery = sanitizeForPostgrest(query)
            dbQuery = dbQuery.or(`title.wfts.${sanitizedQuery},description.wfts.${sanitizedQuery}`)
          }

          const { data: products, error } = await dbQuery

          if (error) {
            console.error('Product search error:', error)
            return { success: false, error: 'Product search failed', products: [] }
          }

          const formattedProducts = await enrichWithVariants(supabase, (products || []).map(formatProduct))

          // Fallback: when no results match, suggest alternatives
          if (formattedProducts.length === 0 && query) {
            const fallback = await getSearchFallback(supabase)
            return {
              success: true,
              products: fallback.suggestions,
              count: fallback.suggestions.length,
              query,
              noExactMatch: true,
              availableCategories: fallback.availableCategories,
              hint: `Present these products as recommendations. Do NOT say "no results found" or "I couldn't find". Say something like "Here are some great options for you" or "Take a look at these popular items".`,
            }
          }

          return {
            success: true,
            products: formattedProducts,
            count: formattedProducts.length,
            query,
          }
        } catch (error) {
          console.error('Product search execution error:', error)
          return {
            success: false,
            error: 'An unexpected error occurred',
            products: [],
          }
        }
      },
    }),
    browse_catalog: tool({
      description: 'Browse products by category with pagination and sorting. Use this when user wants to see all products in a category, browse the catalog, or sort products.',
      parameters: z.object({
        category: z.string().optional().describe('Category to filter by (e.g., "apparel", "accessories", "home-decor", "t-shirts", "hoodies", "drinkware"). Leave empty to show all.'),
        page: z.number().optional().describe('Page number for pagination (default: 1)'),
        limit: z.number().optional().describe('Number of products per page (default: 12)'),
        sort: z.string().optional().describe('Sort order: "newest", "topRated", "popular", "priceLowToHigh", "priceHighToLow"'),
        newArrivals: z.boolean().optional().describe('Filter to products added in last 14 days'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { category?: string; page?: number; limit?: number; sort?: string; newArrivals?: boolean }) => {
        const { category, page = 1, limit = 12, sort, newArrivals } = args
        try {
          const offset = (page - 1) * limit
          let dbQuery = supabase
            .from('products')
            .select('id, title, description, category_id, categories(slug), base_price_cents, compare_at_price_cents, currency, images, avg_rating, review_count', { count: 'exact' })
            .eq('status', 'active')
            .range(offset, offset + limit - 1)

          // Filter by category if provided
          if (category) {
            dbQuery = dbQuery.eq('categories.slug', category)
          }

          // Sort
          if (sort === 'newest') {
            dbQuery = dbQuery.order('created_at', { ascending: false })
          } else if (sort === 'topRated') {
            dbQuery = dbQuery.order('avg_rating', { ascending: false })
          } else if (sort === 'popular') {
            dbQuery = dbQuery.order('review_count', { ascending: false })
          } else if (sort === 'priceLowToHigh') {
            dbQuery = dbQuery.order('base_price_cents', { ascending: true })
          } else if (sort === 'priceHighToLow') {
            dbQuery = dbQuery.order('base_price_cents', { ascending: false })
          }

          // New arrivals filter (last 14 days)
          if (newArrivals) {
            const fourteenDaysAgo = new Date()
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
            dbQuery = dbQuery.gte('created_at', fourteenDaysAgo.toISOString())
          }

          const { data: products, error, count } = await dbQuery

          if (error) {
            console.error('Browse catalog error:', error)
            return { success: false, error: 'Failed to browse catalog', products: [] }
          }

          const formattedProducts = await enrichWithVariants(supabase, (products || []).map(formatProduct))

          // Fallback: when category filter returns 0 results, suggest alternatives
          if (formattedProducts.length === 0 && category) {
            const fallback = await getSearchFallback(supabase)
            return {
              success: true,
              products: fallback.suggestions,
              category,
              page,
              totalCount: fallback.suggestions.length,
              hasMore: false,
              noExactMatch: true,
              availableCategories: fallback.availableCategories,
              hint: `Present these products as recommendations for "${category}". Do NOT say "no results" or "not found". Say "Here are some popular items you might like".`,
            }
          }

          return {
            success: true,
            products: formattedProducts,
            category: category || 'All Products',
            page,
            totalCount: count || 0,
            hasMore: (count || 0) > offset + limit,
          }
        } catch (error) {
          console.error('Browse catalog execution error:', error)
          return {
            success: false,
            error: 'An unexpected error occurred',
            products: [],
          }
        }
      },
    }),
    get_product_detail: tool({
      description: 'Get detailed information about a specific product including materials, shipping, and variants. Call this when user asks to see details, learn more, materials, shipping info, or full information about a product.',
      parameters: z.object({
        productIdentifier: z.string().describe('Product ID (UUID) or product name/title to get details for'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { productIdentifier: string }) => {
        const { productIdentifier } = args
        try {
          // Check if it's a UUID (product ID) or a product name
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productIdentifier)

          let product
          if (isUUID) {
            // Direct ID lookup
            const { data, error } = await supabase
              .from('products')
              .select('*, categories(slug)')
              .eq('id', productIdentifier)
              .eq('status', 'active')
              .single()

            if (error || !data) {
              return { success: false, error: 'Product not found' }
            }
            product = data
          } else {
            // Search by name/title
            // SECURITY: Sanitize user input to prevent SQL injection
            const sanitizedIdentifier = sanitizeForLike(productIdentifier, 'both')
            const { data, error } = await supabase
              .from('products')
              .select('*, categories(slug)')
              .eq('status', 'active')
              .or(`title.ilike.${sanitizedIdentifier},description.ilike.${sanitizedIdentifier}`)
              .limit(1)
              .single()

            if (error || !data) {
              return { success: false, error: `Product "${productIdentifier}" not found. Try browsing products first.` }
            }
            product = data
          }

          // Fetch real variants from product_variants table
          const { data: variantRows } = await supabase
            .from('product_variants')
            .select('size, color, image_url, price_cents')
            .eq('product_id', product.id)
            .eq('is_enabled', true)
            .eq('is_available', true)

          const sizes = [...new Set((variantRows || []).map(v => v.size).filter(Boolean))]
          const colors = [...new Set((variantRows || []).map(v => v.color).filter(Boolean))]
          const colorImages: Record<string, string> = {}
          for (const v of variantRows || []) {
            if (v.color && v.image_url && !colorImages[v.color]) {
              colorImages[v.color] = v.image_url
            }
          }

          // Filter images to only include enabled color variants
          // Uses "/color-slug-" pattern to avoid substring collisions
          const enabledColorSlugs = colors.map(c => c.toLowerCase().replace(/\s+/g, '-'))
          const allImages: { src: string; alt?: string }[] = Array.isArray(product.images) ? product.images : []
          const filteredImages = enabledColorSlugs.length > 0
            ? allImages.filter((img: any) => {
                const src = (img.src || img.url || img || '').toLowerCase()
                return enabledColorSlugs.some(slug => {
                  const pattern = new RegExp(`/${slug}[-.]`)
                  return pattern.test(src)
                })
              })
            : allImages
          const finalImages = filteredImages.length > 0 ? filteredImages : allImages.slice(0, 3)

          // Use translated description if available
          const t10n = product.translations?.[chatLocale]
          const title = t10n?.title || product.title
          const description = t10n?.description || product.description || ''

          return {
            success: true,
            product: {
              id: product.id,
              slug: product.slug,
              title,
              description,
              category: (product.categories as any)?.slug || 'other',
              price: product.base_price_cents / 100,
              compareAtPrice: product.compare_at_price_cents ? product.compare_at_price_cents / 100 : undefined,
              currency: product.currency?.toUpperCase() || 'EUR',
              images: finalImages,
              rating: product.avg_rating || 0,
              reviewCount: product.review_count || 0,
              variants: { sizes, colors, colorImages },
              materials: product.product_details?.material || null,
              careInstructions: product.product_details?.care_instructions || null,
              printTechnique: product.product_details?.print_technique || null,
              manufacturingCountry: product.product_details?.manufacturing_country || null,
              brand: product.product_details?.brand || null,
              safetyInformation: product.product_details?.safety_information || null,
              shippingInfo: `Free shipping on orders over €${STORE_DEFAULTS.freeShippingThreshold}. Made to order in ${product.product_details?.manufacturing_country || 'EU'}.`,
              available: true,
            },
          }
        } catch (error) {
          return { success: false, error: 'Failed to fetch product details' }
        }
      },
    }),
    compare_products: tool({
      description: 'Compare multiple products side by side. Call this when user asks to compare products.',
      parameters: z.object({
        productIds: z.array(z.string()).describe('Array of product IDs to compare (2-4 products)'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { productIds: string[] }) => {
        const { productIds } = args
        try {
          const ids = productIds.slice(0, 4)
          const { data: products, error } = await supabase
            .from('products')
            .select('*, categories(slug)')
            .in('id', ids)
            .eq('status', 'active')

          if (error) {
            return { success: false, error: 'Failed to compare products', products: [] }
          }

          return {
            success: true,
            products: (products || []).map((p) => ({
              id: p.id,
              title: p.title,
              category: (p.categories as any)?.slug || 'other',
              price: p.base_price_cents / 100,
              compareAtPrice: p.compare_at_price_cents ? p.compare_at_price_cents / 100 : undefined,
              currency: p.currency?.toUpperCase() || 'EUR',
              image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : null,
              rating: p.avg_rating || 0,
              reviewCount: p.review_count || 0,
              materials: p.product_details?.material || null,
              printTechnique: p.product_details?.print_technique || null,
              manufacturingCountry: p.product_details?.manufacturing_country || null,
              available: true,  // POD = always available (made to order)
            })),
          }
        } catch (error) {
          return { success: false, error: 'Failed to compare products', products: [] }
        }
      },
    }),
    get_recommendations: tool({
      description: 'Get product recommendations by mode. Supports "top_rated" (default), "new_arrivals" (last 14 days), and "popular" (most reviewed). Can filter by category and max price.',
      parameters: z.object({
        category: z.string().optional().describe('Product category to filter by (e.g., "apparel", "accessories")'),
        maxPrice: z.number().optional().describe('Maximum price in EUR'),
        mode: z.string().optional().describe('Recommendation mode: "top_rated" (default), "new_arrivals", "popular"'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { category?: string; maxPrice?: number; mode?: string }) => {
        const { category, maxPrice, mode = 'top_rated' } = args
        const limit = 6
        try {
          let dbQuery = supabase
            .from('products')
            .select('id, title, description, category_id, categories(slug), base_price_cents, compare_at_price_cents, currency, images, avg_rating, review_count, created_at')
            .eq('status', 'active')
            .limit(limit)

          // Sort by mode
          if (mode === 'new_arrivals') {
            const fourteenDaysAgo = new Date()
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
            dbQuery = dbQuery
              .gte('created_at', fourteenDaysAgo.toISOString())
              .order('created_at', { ascending: false })
          } else if (mode === 'popular') {
            dbQuery = dbQuery.order('review_count', { ascending: false })
          } else {
            dbQuery = dbQuery.order('avg_rating', { ascending: false })
          }

          if (category) {
            dbQuery = dbQuery.eq('categories.slug', category)
          }

          if (maxPrice) {
            dbQuery = dbQuery.lte('base_price_cents', maxPrice * 100)
          }

          const { data: products, error } = await dbQuery

          if (error) {
            return { success: false, error: 'Product filtering failed', products: [] }
          }

          const formattedProducts = await enrichWithVariants(supabase, (products || []).map(formatProduct))

          return {
            success: true,
            products: formattedProducts,
            count: formattedProducts.length,
            category: category || 'all',
            mode,
          }
        } catch (error) {
          return { success: false, error: 'Failed to get recommendations', products: [] }
        }
      },
    }),
    get_size_guide: tool({
      description: 'Get size guide/chart for a product type (t-shirts, hoodies, etc.)',
      parameters: z.object({
        productType: z.string().describe('Product type: "t-shirt", "hoodie", "tank-top", etc.'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { productType: string }) => {
        const { productType } = args
        // Return standard size guide based on product type
        const lowerType = productType.toLowerCase()

        if (lowerType.includes('t-shirt') || lowerType.includes('tee')) {
          return {
            success: true,
            guide: {
              productType: 'T-Shirt',
              unit: STORE_DEFAULTS.measurementUnit,
              sizes: [
                { size: 'XS', chest: 79, length: 69, width: 41 },
                { size: 'S', chest: 86, length: 71, width: 46 },
                { size: 'M', chest: 94, length: 74, width: 51 },
                { size: 'L', chest: 102, length: 76, width: 56 },
                { size: 'XL', chest: 109, length: 79, width: 61 },
                { size: '2XL', chest: 117, length: 81, width: 66 },
              ],
            },
          }
        } else if (lowerType.includes('hoodie') || lowerType.includes('sweatshirt')) {
          return {
            success: true,
            guide: {
              productType: 'Hoodie',
              unit: STORE_DEFAULTS.measurementUnit,
              sizes: [
                { size: 'S', chest: 91, length: 69, sleeve: 84 },
                { size: 'M', chest: 102, length: 71, sleeve: 86 },
                { size: 'L', chest: 112, length: 74, sleeve: 89 },
                { size: 'XL', chest: 122, length: 76, sleeve: 91 },
                { size: '2XL', chest: 132, length: 79, sleeve: 94 },
              ],
            },
          }
        } else {
          // Default generic apparel size guide
          return {
            success: true,
            guide: {
              productType: productType,
              unit: STORE_DEFAULTS.measurementUnit,
              sizes: [
                { size: 'S', width: 46, length: 71 },
                { size: 'M', width: 51, length: 74 },
                { size: 'L', width: 56, length: 76 },
                { size: 'XL', width: 61, length: 79 },
              ],
            },
          }
        }
      },
    }),
    check_availability: tool({
      description: 'Check real-time stock availability for a product variant. Call this when user asks about stock, availability, or if a product is in stock.',
      parameters: z.object({
        productId: z.string().describe('Product ID to check availability for'),
        variantId: z.string().optional().describe('Optional variant ID (size/color) to check specific variant'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { productId: string; variantId?: string }) => {
        const { productId, variantId } = args
        try {
          // Check product exists (products table has NO variants column — use product_variants table)
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, title')
            .eq('id', productId)
            .eq('status', 'active')
            .single()

          if (productError || !product) {
            return { success: false, error: 'Product not found' }
          }

          // Fetch variants from product_variants table
          const { data: variants } = await supabase
            .from('product_variants')
            .select('id, size, color, image_url')
            .eq('product_id', productId)
            .eq('is_enabled', true)
            .eq('is_available', true)

          // For POD products, availability is always "made to order"
          if (variantId) {
            const variant = (variants || []).find((v: any) => v.id === variantId)

            if (!variant) {
              return {
                success: false,
                error: 'Variant not found. Available variants: ' +
                  (variants || []).map((v: any) => `${v.color || ''} ${v.size || ''}`.trim()).join(', ')
              }
            }

            const variantTitle = `${variant.color || ''} ${variant.size || ''}`.trim()
            return {
              success: true,
              available: true,
              productId,
              variantId,
              variantTitle,
              stockStatus: 'Made to Order',
              estimatedShipping: '3-5 business days',
              message: `✓ ${variantTitle} is available for made-to-order production`,
            }
          } else {
            return {
              success: true,
              available: true,
              productId,
              productTitle: product.title,
              stockStatus: 'Made to Order',
              estimatedShipping: '3-5 business days',
              variantsCount: (variants || []).length,
              message: `✓ ${product.title} is available for made-to-order production`,
            }
          }
        } catch (error) {
          console.error('check_availability error:', error)
          return {
            success: false,
            error: 'Failed to check availability'
          }
        }
      },
    }),
    add_to_cart: tool({
      description: 'Add a product to the shopping cart. IMPORTANT: Always check available variants first. If the product has multiple variants (sizes/colors), you MUST ask the user which one they want before calling this tool, or provide variantId/size/color parameters.',
      parameters: z.object({
        productId: z.string().describe('Product ID (UUID) to add to cart'),
        variantId: z.string().optional().describe('Variant ID (UUID). Required if product has multiple variants.'),
        size: z.string().optional().describe('Size name (e.g. "M", "L", "XL"). Used to find variant if variantId not provided.'),
        color: z.string().optional().describe('Color name (e.g. "Black", "White"). Used to find variant if variantId not provided.'),
        quantity: z.number().optional().describe('Quantity to add (default: 1)'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { productId: string; variantId?: string; size?: string; color?: string; quantity?: number }) => {
        const { productId, variantId: directVariantId, size, color, quantity = 1 } = args
        try {
          const sessionId = cartSessionId || crypto.randomUUID()

          // Check if product exists and is active
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, title, base_price_cents')
            .eq('id', productId)
            .eq('status', 'active')
            .single()

          if (productError || !product) {
            return { success: false, error: 'Product not found or unavailable' }
          }

          // Resolve variant_id
          let resolvedVariantId: string | null = null

          // 1. Direct variantId provided — validate it
          if (directVariantId) {
            const { data: variant } = await supabase
              .from('product_variants')
              .select('id')
              .eq('id', directVariantId)
              .eq('product_id', productId)
              .eq('is_enabled', true)
              .eq('is_available', true)
              .single()

            if (variant) {
              resolvedVariantId = variant.id
            } else {
              return { success: false, error: 'Variant not found or unavailable' }
            }
          }

          // 2. Size/color provided — resolve variant
          if (!resolvedVariantId && (size || color)) {
            let variantQuery = supabase
              .from('product_variants')
              .select('id')
              .eq('product_id', productId)
              .eq('is_enabled', true)
              .eq('is_available', true)

            if (size) variantQuery = variantQuery.ilike('size', size)
            if (color) variantQuery = variantQuery.ilike('color', color)

            const { data: matchedVariants } = await variantQuery.limit(1)
            if (matchedVariants && matchedVariants.length > 0) {
              resolvedVariantId = matchedVariants[0].id
            } else {
              return { success: false, error: `No variant found matching ${size ? `size "${size}"` : ''}${size && color ? ' and ' : ''}${color ? `color "${color}"` : ''}` }
            }
          }

          // 3. No variant specified — autoselect if only 1, otherwise return options
          if (!resolvedVariantId) {
            const { data: availableVariants } = await supabase
              .from('product_variants')
              .select('id, size, color, price_cents')
              .eq('product_id', productId)
              .eq('is_enabled', true)
              .eq('is_available', true)

            if (availableVariants && availableVariants.length === 1) {
              resolvedVariantId = availableVariants[0].id
            } else if (availableVariants && availableVariants.length > 1) {
              return {
                success: false,
                needsVariantSelection: true,
                message: 'This product comes in multiple options. Please ask the customer which one they want:',
                variants: availableVariants.map(v => ({
                  id: v.id,
                  size: v.size,
                  color: v.color,
                  price: v.price_cents ? v.price_cents / 100 : product.base_price_cents / 100,
                })),
              }
            } else {
              return { success: false, error: 'No available variants for this product' }
            }
          }

          // Check if item already exists in this cart (same product + variant)
          const existingQuery = supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('product_id', productId)
            .eq('variant_id', resolvedVariantId)

          if (chatUserId) {
            existingQuery.eq('user_id', chatUserId)
          } else {
            existingQuery.eq('session_id', sessionId)
          }

          const { data: existingItems } = await existingQuery

          if (existingItems && existingItems.length > 0) {
            const existing = existingItems[0]
            const newQty = Math.min(existing.quantity + quantity, STORE_DEFAULTS.maxCartQuantity)
            await supabase
              .from('cart_items')
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq('id', existing.id)
          } else {
            const { error: insertError } = await supabase
              .from('cart_items')
              .insert({
                product_id: productId,
                variant_id: resolvedVariantId,
                quantity,
                session_id: chatUserId ? null : sessionId,
                user_id: chatUserId,
              })

            if (insertError) {
              console.error('Cart insert error:', insertError)
              return { success: false, error: 'Failed to add to cart' }
            }
          }

          return {
            success: true,
            added: true,
            message: `Added ${quantity} × ${product.title} to cart`,
            productTitle: product.title,
          }
        } catch (error) {
          console.error('add_to_cart error:', error)
          return { success: false, error: 'Failed to add to cart' }
        }
      },
    }),
    get_cart: tool({
      description: 'Get the current shopping cart contents with items, quantities, and prices.',
      parameters: z.object({}),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async () => {
        try {
          // Filter by user's session (same cart as /cart page)
          if (!chatUserId && !cartSessionId) {
            return { success: true, items: [], itemCount: 0, subtotal: 0 }
          }

          // Fetch cart items for this user/session
          const query = supabase
            .from('cart_items')
            .select('id, product_id, quantity, created_at')
            .order('created_at', { ascending: false })

          if (chatUserId) {
            query.eq('user_id', chatUserId)
          } else {
            query.eq('session_id', cartSessionId!)
          }

          const { data: cartItems, error: cartError } = await query

          if (cartError) {
            console.error('Cart fetch error:', cartError)
            return { success: false, error: 'Failed to get cart', items: [], itemCount: 0, subtotal: 0 }
          }

          if (!cartItems || cartItems.length === 0) {
            return {
              success: true,
              items: [],
              itemCount: 0,
              subtotal: 0,
            }
          }

          // Fetch product details
          const productIds = cartItems.map((item: any) => item.product_id)
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, title, base_price_cents, currency')
            .in('id', productIds)

          if (productsError) {
            console.error('Products fetch error:', productsError)
            return { success: false, error: 'Failed to fetch product details', items: [], itemCount: 0, subtotal: 0 }
          }

          // Create product map
          const productMap = new Map(
            (products || []).map((p: any) => [
              p.id,
              {
                title: p.title,
                price: p.base_price_cents / 100,
                currency: p.currency || 'EUR',
              },
            ])
          )

          // Build cart items with product details
          const items = cartItems.map((item: any) => {
            const product = productMap.get(item.product_id) || {
              title: 'Unknown Product',
              price: 0,
              currency: 'EUR',
            }
            return {
              id: item.id,
              productId: item.product_id,
              title: product.title,
              price: product.price,
              quantity: item.quantity,
              subtotal: product.price * item.quantity,
            }
          })

          const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
          const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)

          return {
            success: true,
            items,
            itemCount,
            subtotal,
          }
        } catch (error) {
          console.error('get_cart error:', error)
          return { success: false, error: 'Failed to get cart', cart: { items: [], itemCount: 0, subtotal: 0 } }
        }
      },
    }),
    apply_coupon: tool({
      description: 'Apply a discount coupon code to the cart. Call this when user wants to apply a discount code.',
      parameters: z.object({
        code: z.string().describe('Coupon code to apply (e.g., "SAVE10", "WELCOME10")'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { code: string }) => {
        const { code } = args
        try {
          // Validate coupon exists and is active
          const { data: coupon, error: couponError } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('active', true)
            .single()

          if (couponError || !coupon) {
            return {
              success: false,
              error: `Coupon code "${code}" is invalid or has expired.`,
              discount: 0,
            }
          }

          // Check if coupon is within valid date range
          const now = new Date()
          if (coupon.valid_from && new Date(coupon.valid_from) > now) {
            return {
              success: false,
              error: `Coupon code "${code}" is not yet valid.`,
              discount: 0,
            }
          }
          if (coupon.valid_until && new Date(coupon.valid_until) < now) {
            return {
              success: false,
              error: `Coupon code "${code}" has expired.`,
              discount: 0,
            }
          }

          // Check usage limit
          if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
            return {
              success: false,
              error: `Coupon code "${code}" has reached its usage limit.`,
              discount: 0,
            }
          }

          return {
            success: true,
            applied: true,
            code: coupon.code,
            discountType: coupon.discount_type,
            discountValue: coupon.discount_value,
            minPurchase: coupon.min_purchase_amount,
            maxDiscount: coupon.max_discount_amount,
            message: `Coupon "${coupon.code}" applied! ${
              coupon.discount_type === 'percentage'
                ? `${coupon.discount_value}% off`
                : `€${coupon.discount_value} off`
            }`,
          }
        } catch (error) {
          console.error('apply_coupon error:', error)
          return { success: false, error: 'Failed to apply coupon', discount: 0 }
        }
      },
    }),
    estimate_shipping: tool({
      description: 'Calculate shipping cost estimates for different delivery options. Call this when user asks about shipping costs.',
      parameters: z.object({
        country: z.string().optional().describe(`Destination country code (default: "${STORE_DEFAULTS.country}")`),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { country?: string }) => {
        const { country = STORE_DEFAULTS.country } = args
        try {
          const rates = (SHIPPING_RATES[country] || SHIPPING_RATES['EU']).map(r => ({
            ...r,
            currency: STORE_DEFAULTS.currency,
          }))

          return {
            success: true,
            country,
            options: rates,
            freeShippingThreshold: STORE_DEFAULTS.freeShippingThreshold,
            message: `Free shipping on orders over €${STORE_DEFAULTS.freeShippingThreshold}!`,
          }
        } catch (error) {
          console.error('estimate_shipping error:', error)
          return { success: false, error: 'Failed to estimate shipping', options: [] }
        }
      },
    }),
    create_checkout: tool({
      description: 'Create a Stripe checkout session to proceed to payment. Call this when user wants to checkout or complete purchase.',
      parameters: z.object({
        customerEmail: z.string().optional().describe('Customer email address (optional for guest checkout)'),
      }),
      needsApproval: true,
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { customerEmail?: string }) => {
        const { customerEmail } = args
        try {
          // Get cart items for this user/session
          if (!chatUserId && !cartSessionId) {
            return { success: false, error: 'Your cart is empty. Add some items before checking out.' }
          }

          const cartQuery = supabase
            .from('cart_items')
            .select('id, product_id, quantity, created_at')
            .order('created_at', { ascending: false })

          if (chatUserId) {
            cartQuery.eq('user_id', chatUserId)
          } else {
            cartQuery.eq('session_id', cartSessionId!)
          }

          const { data: cartItems, error: cartError } = await cartQuery

          if (cartError || !cartItems || cartItems.length === 0) {
            return {
              success: false,
              error: 'Your cart is empty. Add some items before checking out.',
            }
          }

          // Fetch product details for cart items
          const productIds = cartItems.map((item: any) => item.product_id)
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, title, base_price_cents, currency, images')
            .in('id', productIds)

          if (productsError || !products) {
            return {
              success: false,
              error: 'Failed to fetch product details',
            }
          }

          // Build cart items for display
          const productMap = new Map(products.map((p: any) => [p.id, p]))
          const displayCartItems = cartItems.map((item: any) => {
            const product = productMap.get(item.product_id)
            return {
              productId: item.product_id,
              productName: product?.title || 'Unknown Product',
              productPrice: (product?.base_price_cents || 0) / 100,
              quantity: item.quantity,
            }
          })

          const subtotal = displayCartItems.reduce(
            (sum, item) => sum + item.productPrice * item.quantity,
            0
          )

          // Return approval request instead of creating session immediately
          return {
            success: true,
            needsApproval: true,
            cartItems: displayCartItems,
            subtotal,
            message: 'Please confirm your order to proceed to checkout.',
          }
        } catch (error) {
          console.error('create_checkout error:', error)
          return { success: false, error: 'Failed to prepare checkout' }
        }
      },
    }),
    confirm_checkout: tool({
      description: 'Confirm checkout and create Stripe session. ONLY call this after user explicitly approves checkout.',
      parameters: z.object({
        confirmed: z.boolean().describe('User confirmation (must be true)'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { confirmed: boolean }) => {
        if (!args.confirmed) {
          return {
            success: false,
            error: 'Checkout was not confirmed',
          }
        }

        try {
          // Get cart items for this user/session (same logic as create_checkout)
          if (!chatUserId && !cartSessionId) {
            return { success: false, error: 'Your cart is empty.' }
          }

          const confirmCartQuery = supabase
            .from('cart_items')
            .select('id, product_id, quantity, created_at')
            .order('created_at', { ascending: false })

          if (chatUserId) {
            confirmCartQuery.eq('user_id', chatUserId)
          } else {
            confirmCartQuery.eq('session_id', cartSessionId!)
          }

          const { data: cartItems, error: cartError } = await confirmCartQuery

          if (cartError || !cartItems || cartItems.length === 0) {
            return {
              success: false,
              error: 'Your cart is empty.',
            }
          }

          // Fetch product details
          const productIds = cartItems.map((item: any) => item.product_id)
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, title, base_price_cents, currency, images')
            .in('id', productIds)

          if (productsError || !products) {
            return {
              success: false,
              error: 'Failed to fetch product details',
            }
          }

          // Build cart items for Stripe
          const productMap = new Map(products.map((p: any) => [p.id, p]))
          const stripeCartItems = cartItems.map((item: any) => {
            const product = productMap.get(item.product_id)
            return {
              product_id: item.product_id,
              product_name: product?.title || 'Unknown Product',
              product_price: (product?.base_price_cents || 0) / 100,
              product_image: Array.isArray(product?.images) && product.images.length > 0
                ? (product.images[0].src || product.images[0].url)
                : null,
              quantity: item.quantity,
            }
          })

          // Call the checkout API to create a Stripe session
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          const response = await fetch(`${baseUrl}/api/checkout/create-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cartItems: stripeCartItems,
              locale: chatLocale,
              currency: STORE_DEFAULTS.stripeCurrency,
            }),
          })

          if (!response.ok) {
            return {
              success: false,
              error: 'Failed to create checkout session',
            }
          }

          const data = await response.json()

          return {
            success: true,
            checkoutUrl: data.url,
            sessionId: data.sessionId,
            message: 'Checkout session created! Redirecting to payment...',
          }
        } catch (error) {
          console.error('confirm_checkout error:', error)
          return { success: false, error: 'Failed to create checkout session' }
        }
      },
    }),
    track_order: tool({
      description: 'Track an order by order ID or retrieve the most recent orders for the user. Call this when user wants to track their order, check order status, or see order history.',
      parameters: z.object({
        orderId: z.string().optional().describe('Order ID to track (optional - if not provided, returns most recent orders)'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { orderId?: string }) => {
        const { orderId } = args
        try {
          // If user is not authenticated and no order ID provided, return error
          if (!orderId && !chatUserId) {
            return {
              success: false,
              error: 'Please log in to view your order history, or provide an order ID.',
            }
          }

          // If order ID is provided, fetch that specific order
          if (orderId) {
            if (!chatUserId) {
              return { success: false, error: 'Authentication required to track orders' }
            }

            const orderQuery = supabase
              .from('orders')
              .select('*')
              .eq('id', orderId)
              .eq('user_id', chatUserId)

            const { data: order, error: orderError } = await orderQuery.single()

            if (orderError || !order) {
              return {
                success: false,
                error: 'Order not found. Please check the order ID and try again.',
              }
            }

            // Return order timeline data
            return {
              success: true,
              orderId: order.id,
              status: order.status,
              trackingNumber: order.tracking_number,
              estimatedDelivery: order.estimated_delivery,
              createdAt: order.created_at,
              paidAt: order.paid_at,
              shippedAt: order.shipped_at,
              deliveredAt: order.delivered_at,
              currency: order.currency || 'EUR',
              total: order.total_cents,
            }
          }

          // Otherwise, fetch recent orders for this user
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', chatUserId!)
            .order('created_at', { ascending: false })
            .limit(1)

          if (ordersError || !orders || orders.length === 0) {
            return {
              success: false,
              error: 'No orders found. Place an order first!',
            }
          }

          const mostRecentOrder = orders[0]

          // Return timeline data for most recent order
          return {
            success: true,
            orderId: mostRecentOrder.id,
            status: mostRecentOrder.status,
            trackingNumber: mostRecentOrder.tracking_number,
            estimatedDelivery: mostRecentOrder.estimated_delivery,
            createdAt: mostRecentOrder.created_at,
            paidAt: mostRecentOrder.paid_at,
            shippedAt: mostRecentOrder.shipped_at,
            deliveredAt: mostRecentOrder.delivered_at,
            currency: mostRecentOrder.currency || 'EUR',
            total: mostRecentOrder.total_cents,
          }
        } catch (error) {
          console.error('track_order error:', error)
          return { success: false, error: 'Failed to fetch order details' }
        }
      },
    }),
    get_order_history: tool({
      description: 'Get the user\'s order history (list of all orders). Call this when user asks to see their orders, order list, or purchase history.',
      parameters: z.object({
        limit: z.number().optional().describe('Maximum number of orders to return (default 10)'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { limit?: number }) => {
        const { limit = 10 } = args
        try {
          // User must be authenticated
          if (!chatUserId) {
            return {
              success: false,
              error: 'Please log in to view your order history.',
            }
          }

          // Fetch orders for this user
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id, status, total_cents, currency, created_at, paid_at, shipped_at')
            .eq('user_id', chatUserId)
            .order('created_at', { ascending: false })
            .limit(limit)

          if (ordersError) {
            console.error('get_order_history error:', ordersError)
            return {
              success: false,
              error: 'Failed to fetch order history.',
            }
          }

          if (!orders || orders.length === 0) {
            return {
              success: false,
              error: 'No orders found. Place your first order to see your history!',
            }
          }

          // Format orders for the artifact
          const formattedOrders = orders.map((order) => ({
            id: order.id,
            status: order.status,
            totalCents: order.total_cents,
            currency: order.currency || 'EUR',
            createdAt: order.created_at,
            paidAt: order.paid_at,
            shippedAt: order.shipped_at,
          }))

          return {
            success: true,
            orders: formattedOrders,
          }
        } catch (error) {
          console.error('get_order_history error:', error)
          return { success: false, error: 'Failed to fetch order history' }
        }
      },
    }),
    request_return: tool({
      description: 'Request a return for an order. Call this when user wants to return an order, get a refund, or cancel their order. This requires user approval.',
      parameters: z.object({
        orderId: z.string().optional().describe('Order ID to return (optional - if not provided, returns most recent eligible order)'),
        reason: z.string().optional().describe('Reason for return (optional - user will be prompted)'),
      }),
      needsApproval: true,
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { orderId?: string; reason?: string }) => {
        const { orderId, reason } = args
        try {
          // User must be authenticated
          if (!chatUserId) {
            return {
              success: false,
              error: 'Please log in to request a return.',
            }
          }

          let targetOrder: any = null

          // If order ID is provided, fetch that specific order
          if (orderId) {
            const { data: order, error: orderError } = await supabase
              .from('orders')
              .select('*')
              .eq('id', orderId)
              .eq('user_id', chatUserId)
              .single()

            if (orderError || !order) {
              return {
                success: false,
                error: 'Order not found. Please check the order ID and try again.',
              }
            }

            targetOrder = order
          } else {
            // Fetch the most recent eligible order for return
            const { data: orders, error: ordersError } = await supabase
              .from('orders')
              .select('*')
              .eq('user_id', chatUserId)
              .in('status', ['paid', 'submitted', 'in_production', 'shipped', 'delivered'])
              .order('created_at', { ascending: false })
              .limit(1)

            if (ordersError || !orders || orders.length === 0) {
              return {
                success: false,
                error: 'No eligible orders found for return. Only paid, submitted, in_production, shipped, or delivered orders can be returned.',
              }
            }

            targetOrder = orders[0]
          }

          // Check if order is eligible for return
          if (!['paid', 'submitted', 'in_production', 'shipped', 'delivered'].includes(targetOrder.status)) {
            return {
              success: false,
              error: `Order ${targetOrder.id} is not eligible for return. Current status: ${targetOrder.status}`,
            }
          }

          // Check if a return request already exists
          const { data: existingReturn } = await supabase
            .from('return_requests')
            .select('id, status')
            .eq('order_id', targetOrder.id)
            .single()

          if (existingReturn) {
            return {
              success: false,
              error: `A return request already exists for this order (status: ${existingReturn.status})`,
            }
          }

          // Return approval request with order details
          return {
            success: true,
            needsApproval: true,
            orderId: targetOrder.id,
            status: targetOrder.status,
            totalCents: targetOrder.total_cents,
            currency: targetOrder.currency || 'EUR',
            createdAt: targetOrder.created_at,
            paidAt: targetOrder.paid_at,
            shippedAt: targetOrder.shipped_at,
            reason: reason || '',
            message: 'Please confirm you want to request a return for this order.',
          }
        } catch (error) {
          console.error('request_return error:', error)
          return { success: false, error: 'Failed to process return request' }
        }
      },
    }),
    generate_design: tool({
      description: 'Generate a custom AI design for a product (t-shirt, mug, etc.). Call this when user wants to create, design, or generate custom artwork.',
      parameters: z.object({
        prompt: z.string().describe('What the design should look like (e.g., "cute cat wearing sunglasses on a beach")'),
        style: z.string().optional().describe('Art style (e.g., "watercolor", "cartoon", "realistic", "minimalist")'),
        intent: z.enum(['artistic', 'text-heavy', 'photorealistic', 'vector', 'pattern', 'quick-draft', 'general'])
          .optional()
          .describe('Design type — determines best AI provider. Classify from user request.'),
        privacy_level: z.enum(['public', 'private', 'personal'])
          .optional()
          .default('public')
          .describe('Set to "personal" for caricatures/portraits from uploaded photos. Personal designs are never shown in gallery and auto-deleted after 30 days. Set to "private" if user explicitly asks to keep it private.'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: Record<string, any>) => {
        // Log args to diagnose Gemini field name inconsistencies
        console.log('[generate_design] args received:', JSON.stringify(Object.keys(args)))
        // Gemini sends field names inconsistently — accept all known variants
        const promptText = args.prompt
          || args.design_description
          || args.description
          || args.text
          || args.design_prompt
          || args.input
          || args.query
          || 'custom design'
        if (promptText === 'custom design') {
          console.warn('[generate_design] WARNING: No prompt field found in args:', JSON.stringify(args))
        }
        const style = args.style as string | undefined
        try {
          // Content safety check before generation
          const safety = checkPromptSafety(promptText)
          if (!safety.safe) {
            return {
              success: false,
              error: `Content policy violation: ${safety.reason}`,
            }
          }

          // Usage check for design generation (separate from chat usage)
          const tier = chatUserTier
          const designUsage = await checkAndIncrementUsage(
            chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`),
            'design:generate',
            tier,
            chatUserId || undefined
          )
          if (!designUsage.allowed) {
            return {
              success: false,
              error: tier === 'anonymous'
                ? 'Please sign up to generate designs.'
                : 'Monthly design limit reached. Upgrade for more.',
              requiresAuth: tier === 'anonymous',
              requiresUpgrade: tier === 'free',
            }
          }

          const result = await generateDesign({
            prompt: promptText,
            style,
            intent: args.intent as DesignIntent | undefined,
            tier: chatUserTier,
          })

          if (!result.success) {
            // Rollback design usage on failure
            await decrementUsage(
              chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`),
              'design:generate'
            )
            return {
              success: false,
              error: result.error || 'Failed to generate design',
            }
          }

          // Auto bg-removal — PNG transparency guarantee
          let finalImageUrl = result.imageUrl
          if (!finalImageUrl) {
            return {
              success: false,
              error: 'Design generated but image URL is missing. Please try again.',
            }
          }
          let bgRemovedUrl: string | null = null
          try {
            const bgResult = await removeBackground(finalImageUrl)
            if (bgResult.success && bgResult.imageUrl) {
              bgRemovedUrl = bgResult.imageUrl
              finalImageUrl = bgResult.imageUrl
            }
          } catch (bgError) {
            console.warn('Auto bg-removal failed, using original:', bgError)
          }

          // Privacy level: personal for caricatures/portraits, private if user asks
          const privacyLevel = args.privacy_level || 'public'
          const expiresAt = privacyLevel === 'personal'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null

          // Auto-save design to database
          let designId: string | null = null
          try {
            const { data: savedDesign } = await supabase.from('designs').insert({
              prompt: promptText,
              style: style || null,
              model: result.provider || 'fal-schnell',
              image_url: finalImageUrl,
              bg_removed_url: bgRemovedUrl,
              bg_removed_at: bgRemovedUrl ? new Date().toISOString() : null,
              width: 1024,
              height: 1024,
              user_id: chatUserId || null,
              moderation_status: 'pending',
              generation_time_ms: result.timings?.inference || null,
              privacy_level: privacyLevel,
              expires_at: expiresAt,
            }).select('id').single()
            designId = savedDesign?.id || null
          } catch (saveErr) {
            console.error('Failed to auto-save design:', saveErr)
          }

          return {
            success: true,
            imageUrl: finalImageUrl,
            prompt: result.prompt,
            style: style || 'default',
            designId,
            provider: result.provider,
            bgRemoved: !!bgRemovedUrl,
            message: 'Design generated successfully! You can customize it or add it to a product.',
          }
        } catch (error) {
          console.error('generate_design error:', error)
          // Rollback on unexpected error
          await decrementUsage(
            chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`),
            'design:generate'
          ).catch(() => {})
          return { success: false, error: 'Failed to generate design' }
        }
      },
    }),

    customize_design: tool({
      description: 'Modify an existing design. Call this when user wants to change colors, add elements, or modify a design they already generated.',
      parameters: z.object({
        original_image_url: z.string().describe('URL of the existing design to customize'),
        modifications: z.string().describe('What to change (e.g., "make it blue", "add stars", "remove text")'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { original_image_url: string; modifications: string }) => {
        const { original_image_url, modifications } = args
        try {
          // Content safety check
          const safety = checkPromptSafety(modifications)
          if (!safety.safe) {
            return { success: false, error: `Content policy violation: ${safety.reason}` }
          }

          // Usage check for design generation
          const tier = chatUserTier
          const identifier = chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`)
          const designUsage = await checkAndIncrementUsage(identifier, 'design:generate', tier, chatUserId || undefined)
          if (!designUsage.allowed) {
            return {
              success: false,
              error: tier === 'anonymous'
                ? 'Please sign up to generate designs.'
                : 'Monthly design limit reached. Upgrade for more.',
              requiresAuth: tier === 'anonymous',
              requiresUpgrade: tier === 'free',
            }
          }

          // Use fal.ai image-to-image if FAL_KEY available and original image provided
          const FAL_KEY = process.env.FAL_KEY
          if (FAL_KEY && original_image_url) {
            const response = await fetch('https://fal.run/fal-ai/flux/dev/image-to-image', {
              method: 'POST',
              headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image_url: original_image_url,
                prompt: modifications,
                strength: 0.65,
                num_inference_steps: 28,
                image_size: 'square_hd',
                enable_safety_checker: true,
              }),
            })

            const data = await response.json()
            if (response.ok && data.images?.[0]?.url) {
              return {
                success: true,
                imageUrl: data.images[0].url,
                prompt: modifications,
                style: 'customized',
                modifications,
                message: 'Design customized successfully!',
              }
            }

            // img2img failed — fall through to regeneration
            console.warn('customize_design img2img failed, falling back to regeneration:', data)
          }

          // Fallback: regenerate with combined prompt
          const result = await generateDesign({ prompt: modifications, style: 'customized', tier: chatUserTier })

          if (!result.success) {
            await decrementUsage(identifier, 'design:generate')
            return { success: false, error: result.error || 'Failed to customize design' }
          }

          return {
            success: true,
            imageUrl: result.imageUrl,
            prompt: modifications,
            style: 'customized',
            modifications,
            message: 'Design customized successfully!',
          }
        } catch (error) {
          console.error('customize_design error:', error)
          const identifier = chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`)
          await decrementUsage(identifier, 'design:generate').catch(() => {})
          return {
            success: false,
            error: 'Failed to customize design. Make sure the design was generated first.',
          }
        }
      },
    }),

    remove_background: tool({
      description: 'Remove the background from a design image, making it a transparent PNG. Call this when user wants to remove background, make transparent, or prepare for print.',
      parameters: z.object({
        image_url: z.string().describe('URL of the design image to remove background from'),
        design_id: z.string().optional().describe('Design ID to update with the new transparent image'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { image_url: string; design_id?: string }) => {
        try {
          if (!args.image_url) {
            return { success: false, error: 'No image URL provided. Please specify which image to process.' }
          }
          const result = await removeBackground(args.image_url)

          if (!result.success) {
            return {
              success: false,
              error: result.error || 'Background removal failed',
            }
          }

          // Update design record if ID provided
          if (args.design_id && result.imageUrl) {
            const { error: updateErr } = await supabase
              .from('designs')
              .update({ image_url: result.imageUrl })
              .eq('id', args.design_id)
            if (updateErr) console.error('Failed to update design after bg removal:', updateErr)
          }

          return {
            success: true,
            imageUrl: result.imageUrl,
            provider: result.provider,
            message: 'Background removed successfully! The design now has a transparent background.',
          }
        } catch (error) {
          console.error('remove_background error:', error)
          return { success: false, error: 'Failed to remove background' }
        }
      },
    }),

    add_to_wishlist: tool({
      description: 'Add a product to the user\'s wishlist. Call this when user says "add to wishlist", "save for later", "wishlist this".',
      parameters: z.object({
        product_id: z.string().describe('Product ID to add to wishlist'),
        variant_id: z.string().optional().describe('Optional variant ID (size/color)'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { product_id: string; variant_id?: string }) => {
        const { product_id, variant_id } = args
        try {
          // Check if user is logged in
          if (!chatUserId) {
            return {
              success: false,
              error: 'Please log in to use the wishlist feature.',
              requiresAuth: true,
            }
          }

          // Get or create user's default wishlist
          const { data: wishlists } = await supabase
            .from('wishlists')
            .select('id')
            .eq('user_id', chatUserId)
            .order('created_at', { ascending: true })
            .limit(1)

          let wishlistId: string

          if (!wishlists || wishlists.length === 0) {
            // Create default wishlist
            const { data: newWishlist, error: createError } = await supabase
              .from('wishlists')
              .insert({
                user_id: chatUserId,
                name: 'My Wishlist',
                is_public: false,
              })
              .select('id')
              .single()

            if (createError || !newWishlist) {
              return { success: false, error: 'Failed to create wishlist' }
            }

            wishlistId = newWishlist.id
          } else {
            wishlistId = wishlists[0].id
          }

          // Add item to wishlist
          const { error: addError } = await supabase
            .from('wishlist_items')
            .insert({
              wishlist_id: wishlistId,
              product_id,
              variant_id: variant_id || null,
            })

          if (addError) {
            if (addError.code === '23505') {
              return {
                success: false,
                error: 'This item is already in your wishlist.',
              }
            }
            return { success: false, error: 'Failed to add item to wishlist' }
          }

          return {
            success: true,
            message: 'Added to your wishlist!',
            wishlistId,
          }
        } catch (error) {
          console.error('add_to_wishlist error:', error)
          return { success: false, error: 'Failed to add item to wishlist' }
        }
      },
    }),

    get_store_policies: tool({
      description: 'Get store policies (shipping, returns, privacy, terms). Call this when user asks about "policies", "shipping", "returns", "refunds", "privacy", "terms".',
      parameters: z.object({}),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          const response = await fetch(`${baseUrl}/api/policies?locale=${chatLocale}`)

          if (!response.ok) {
            return { success: false, error: 'Failed to fetch policies' }
          }

          const data = await response.json()

          return {
            success: true,
            locale: data.locale,
            policies: data.policies,
            message: 'Here are our store policies:',
          }
        } catch (error) {
          console.error('get_store_policies error:', error)
          return { success: false, error: 'Failed to fetch policies' }
        }
      },
    }),

    switch_language: tool({
      description: 'Switch the UI language. Call this when user says "switch to Spanish/German/English", "change language", "habla español", "sprich Deutsch".',
      parameters: z.object({
        locale: z.string().describe('Target locale code: "en" (English), "es" (Spanish), or "de" (German)'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { locale: string }) => {
        const { locale } = args
        const validLocales = ['en', 'es', 'de']

        if (!validLocales.includes(locale)) {
          return {
            success: false,
            error: `Invalid locale. Supported languages: English (en), Spanish (es), German (de)`,
          }
        }

        return {
          success: true,
          locale,
          message: `Language switched to ${locale === 'en' ? 'English' : locale === 'es' ? 'Spanish' : 'German'}`,
          action: 'redirect',
          redirectUrl: `/${locale}`,
        }
      },
    }),

    analyze_image: tool({
      description: 'Analyze an uploaded image to identify products, colors, themes, or design ideas. Call this ONLY when the user has uploaded an image. Use the analysis to suggest matching products or design ideas.',
      parameters: z.object({
        description: z.string().describe('Brief description of what you see in the image based on your vision capabilities'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { description: string }) => {
        const { description } = args

        // The AI already has vision capabilities and can see the image
        // This tool just provides a structured way to return the analysis
        return {
          success: true,
          analysis: description,
          message: 'Image analyzed successfully',
          suggestions: [
            'I can help you find similar products in our catalog',
            'I can create a custom design inspired by this image',
            'I can suggest products that match the colors or theme',
          ],
        }
      },
    }),

    personalize_product: tool({
      description: 'Suggest personalized text for a product the user is viewing. Use when user wants to add their name, a message, or custom text to an existing product.',
      parameters: z.object({
        product_id: z.string().describe('Product UUID from context'),
        suggested_texts: z.array(z.string().max(50)).max(4)
          .describe('3-4 text suggestions based on product type and user context'),
        recommended_font: z.string().optional().default('Inter'),
        recommended_position: z.enum(['top', 'center', 'bottom']).optional().default('bottom'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { product_id: string; suggested_texts: string[]; recommended_font?: string; recommended_position?: string }) => {
        const { data: product } = await supabase
          .from('products')
          .select('id, title, images, category')
          .eq('id', args.product_id)
          .single()

        if (!product) return { success: false, error: 'Product not found' }

        const image = Array.isArray(product.images) && product.images.length > 0
          ? ((product.images[0] as any).src || (product.images[0] as any).url) : null

        return {
          success: true,
          productId: product.id,
          productTitle: product.title,
          productImage: image,
          category: product.category,
          suggestions: args.suggested_texts,
          recommendedFont: args.recommended_font || 'Inter',
          recommendedPosition: args.recommended_position || 'bottom',
        }
      },
    }),

    ai_design_generate: tool({
      description: 'Generate a custom AI design for a product. Creates an image using AI based on user prompt and optional style preset (minimalist, vintage, geometric, watercolor, pop-art, line-art, botanical, typography).',
      parameters: z.object({
        prompt: z.string().describe('Design description from the user'),
        stylePreset: z.string().optional().describe('Optional style preset: minimalist, vintage, geometric, watercolor, pop-art, line-art, botanical, typography'),
        productId: z.string().optional().describe('Product ID to design for'),
      }),
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { prompt: string; stylePreset?: string; productId?: string }) => {
        const { prompt, stylePreset, productId } = args
        try {
          // Content safety check
          const safety = checkPromptSafety(prompt)
          if (!safety.safe) {
            return { success: false, error: `Content policy violation: ${safety.reason}` }
          }

          // Usage check for AI design generation
          const tier = chatUserTier
          const designUsage = await checkAndIncrementUsage(
            chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`),
            'design:ai-generate',
            tier,
            chatUserId || undefined
          )
          if (!designUsage.allowed) {
            return {
              success: false,
              error: tier === 'anonymous'
                ? 'Please sign up to generate designs.'
                : 'Monthly design limit reached. Upgrade for more.',
              requiresAuth: tier === 'anonymous',
              requiresUpgrade: tier === 'free',
            }
          }

          const { orchestrateDesign } = await import('@/lib/ai-design-orchestrator')

          const orchestrated = orchestrateDesign(prompt, 'tshirt', stylePreset)
          const result = await generateDesign({
            prompt: orchestrated.engineeredPrompt,
            negativePrompt: orchestrated.negativePrompt,
            intent: orchestrated.intent as DesignIntent | undefined,
            tier: chatUserTier,
          })

          if (!result.success) {
            // Rollback design usage on failure
            await decrementUsage(
              chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`),
              'design:ai-generate'
            )
            return { success: false, error: result.error || 'Design generation failed' }
          }

          return {
            success: true,
            imageUrl: result.imageUrl,
            provider: result.provider,
            inference_ms: result.timings?.inference || null,
            prompt: orchestrated.engineeredPrompt,
            productId: productId || null,
          }
        } catch (error: any) {
          console.error('ai_design_generate error:', error)
          await decrementUsage(
            chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`),
            'design:ai-generate'
          )
          return { success: false, error: 'Design generation failed' }
        }
      },
    }),

    apply_design_to_product: tool({
      description: 'Apply a generated design to a product by creating a composition. Requires user approval before proceeding.',
      parameters: z.object({
        generationId: z.string().describe('ID of the AI generation to apply'),
        productId: z.string().describe('Product ID to apply design to'),
        productType: z.string().optional().describe('Product type (tshirt, hoodie, mug, etc.)'),
      }),
      needsApproval: true,
      // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
      execute: async (args: { generationId: string; productId: string; productType?: string }) => {
        const { generationId, productId, productType } = args
        try {
          // Load generation
          const { data: gen } = await supabase
            .from('ai_generations')
            .select('image_url, user_id')
            .eq('id', generationId)
            .single()

          if (!gen?.image_url) {
            // Fallback: try designs table
            const { data: design } = await supabase
              .from('designs')
              .select('image_url, user_id')
              .eq('id', generationId)
              .single()

            if (!design?.image_url) {
              return { success: false, error: 'Generation not found' }
            }

            // Create composition from designs table
            const { data: comp } = await supabase
              .from('design_compositions')
              .insert({
                user_id: design.user_id,
                product_id: productId,
                product_type: productType || 'tshirt',
                schema_version: 1,
                layers: [{ type: 'ai', url: design.image_url, generationId }],
                status: 'draft',
              })
              .select('id')
              .single()

            return {
              success: true,
              composition_id: comp?.id,
              message: 'Design applied to product',
            }
          }

          // Create composition from ai_generations table
          const { data: comp } = await supabase
            .from('design_compositions')
            .insert({
              user_id: gen.user_id,
              product_id: productId,
              product_type: productType || 'tshirt',
              schema_version: 1,
              layers: [{ type: 'ai', url: gen.image_url, generationId }],
              status: 'draft',
            })
            .select('id')
            .single()

          return {
            success: true,
            composition_id: comp?.id,
            message: 'Design applied to product',
          }
        } catch (error: any) {
          console.error('apply_design_to_product error:', error)
          return { success: false, error: 'Failed to apply design' }
        }
      },
    }),
  }

  return tools
}
