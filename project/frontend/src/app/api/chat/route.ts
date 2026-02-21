import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { STORE_DEFAULTS, SHIPPING_RATES, LOCALE_FORMAT } from '@/lib/store-config'
import { chatLimiter, noFpChatLimiter } from '@/lib/rate-limit'
import { generateDesign } from '@/lib/design-generation'
import type { DesignIntent } from '@/lib/providers/router'
import { checkAndIncrementUsage, decrementUsage, usageHeaders, UserTier, USAGE_TIERS } from '@/lib/usage-limiter'
import { checkAnomaly, trackRateLimitHit } from '@/lib/anomaly-monitor'
import { checkPromptSafety } from '@/lib/content-safety'
import { removeBackground } from '@/lib/providers/background-removal'
import { normalizeCategory } from '@/lib/categories'
import { sanitizeForLike, sanitizeForPostgrest } from '@/lib/query-sanitizer'

export const maxDuration = 60

/** Format a raw product row into the shape returned by search/browse tools */
function formatProduct(p: any) {
  return {
    id: p.id,
    title: p.title,
    description: p.description?.substring(0, 150) + (p.description?.length > 150 ? '...' : ''),
    category: normalizeCategory(p.category),
    price: p.base_price_cents / 100,
    currency: p.currency?.toUpperCase() || 'EUR',
    image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : null,
    rating: p.avg_rating || 0,
    reviewCount: p.review_count || 0,
  }
}

// Initialize Google AI with API key
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
})

// Initialize Supabase client for database access
// Use SUPABASE_URL (not NEXT_PUBLIC_*) — NEXT_PUBLIC vars are inlined at build time
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/** Fetch top-rated suggestions + available categories when a search returns 0 results */
async function getSearchFallback() {
  const [catResult, sugResult] = await Promise.all([
    supabase.from('products').select('category').eq('status', 'active'),
    supabase
      .from('products')
      .select('id, title, description, category, base_price_cents, currency, images, avg_rating, review_count')
      .eq('status', 'active')
      .order('avg_rating', { ascending: false })
      .limit(4),
  ])

  const categoryCounts: Record<string, number> = {}
  for (const p of catResult.data || []) {
    const cat = normalizeCategory(p.category)
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  }

  return {
    suggestions: (sugResult.data || []).map(formatProduct),
    availableCategories: Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
  }
}

/**
 * POST /api/chat
 *
 * AI SDK 6 chat endpoint with ToolLoopAgent pattern
 *
 * Tools implemented:
 * - product_search: Search products with semantic filters
 *
 * Future tools:
 * - browse_catalog, get_product_detail, compare_products, etc.
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') || 'unknown'

    // Burst rate limit — stricter for requests without fingerprint
    const fpId = req.headers.get('x-fp-id')
    const limiter = fpId ? chatLimiter : noFpChatLimiter
    const { success } = limiter.check(ip)
    if (!success) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

    // Parse cookies from request headers
    const cookieHeader = req.headers.get('cookie') || ''
    const cookieMap = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [key, ...val] = c.trim().split('=')
        return [key, val.join('=')]
      })
    )
    const cartSessionId = cookieMap['cart-session-id'] || null
    const sbAccessToken = cookieMap['sb-access-token'] || null

    // Extract locale from request
    const acceptLang = req.headers.get('accept-language') || ''
    const localeCookie = cookieMap['NEXT_LOCALE'] || ''
    const chatLocale = localeCookie || (acceptLang.startsWith('de') ? 'de' : acceptLang.startsWith('es') ? 'es' : 'en')

    // Resolve user ID and tier from Supabase auth token (if logged in)
    let chatUserId: string | null = null
    let chatUserTier: UserTier = 'anonymous'
    if (sbAccessToken) {
      const { data: { user } } = await supabase.auth.getUser(sbAccessToken)
      chatUserId = user?.id || null
      if (chatUserId) {
        const { data: profile } = await supabase
          .from('users')
          .select('tier')
          .eq('id', chatUserId)
          .single()
        chatUserTier = (profile?.tier as UserTier) || 'free'
      }
    }

    // Build identifier: prefer fingerprint for anonymous users, then IP
    const chatIdentifier = chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`)

    // Per-tier daily usage check (conversations)
    const usageResult = await checkAndIncrementUsage(chatIdentifier, 'chat', chatUserTier, chatUserId || undefined)
    if (!usageResult.allowed) {
      return Response.json(
        {
          error: chatUserId
            ? 'Daily chat limit reached. Upgrade for more.'
            : 'Daily chat limit reached. Sign up for more.',
          usage: usageResult,
          code: 'LIMIT_REACHED',
        },
        { status: 429, headers: usageHeaders(usageResult) }
      )
    }

    // Per-tier daily message limit (total messages across all conversations)
    const msgUsage = await checkAndIncrementUsage(chatIdentifier, 'chat:messages', chatUserTier, chatUserId || undefined)
    if (!msgUsage.allowed) {
      trackRateLimitHit(chatIdentifier)
      return Response.json(
        {
          error: chatUserId
            ? 'Daily message limit reached. Upgrade for more.'
            : 'Daily message limit reached. Sign up for more.',
          usage: msgUsage,
          code: 'LIMIT_REACHED',
        },
        { status: 429, headers: usageHeaders(msgUsage) }
      )
    }

    // Anomaly detection: check if user is consuming too fast
    const chatLimit = USAGE_TIERS[chatUserTier]?.['chat:messages'] ?? 0
    if (chatLimit > 0) {
      checkAnomaly(chatIdentifier, 'chat:messages', msgUsage.current, chatLimit).catch(() => {})
    }

    const body = await req.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: 'Invalid request: messages array required' },
        { status: 400 }
      )
    }

    // --- Conversation Persistence ---
    const conversationId = req.headers.get('x-conversation-id') || crypto.randomUUID()
    const sessionId = req.headers.get('x-session-id') || cartSessionId || crypto.randomUUID()

    // Upsert conversation record (fire-and-forget, non-blocking)
    ;(async () => {
      try {
        await supabase.from('conversations').upsert({
          id: conversationId,
          user_id: chatUserId || null,
          session_id: sessionId,
          model: 'gemini-2.5-flash',
          locale: chatLocale,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
      } catch (err) {
        console.error('Conversation upsert error (non-critical):', err)
      }
    })()

    // Save the latest user message (fire-and-forget)
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage?.role === 'user') {
      const userContent = typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : Array.isArray(lastUserMessage.parts)
          ? lastUserMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ')
          : JSON.stringify(lastUserMessage.content)

      ;(async () => {
        try {
          await supabase.from('messages').insert({
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            role: 'user',
            content: userContent,
            created_at: new Date().toISOString(),
          })
        } catch (err) {
          console.error('User message save error (non-critical):', err)
        }
      })()
    }

    // Locale-aware greeting and language instruction
    const localeConfig: Record<string, { name: string; instruction: string }> = {
      en: { name: 'English', instruction: 'Respond in English.' },
      es: { name: 'Español', instruction: 'Responde en español. Usa un tono amigable y profesional.' },
      de: { name: 'Deutsch', instruction: 'Antworte auf Deutsch. Verwende einen freundlichen und professionellen Ton.' },
    }
    const currentLocaleConfig = localeConfig[chatLocale] || localeConfig.en

    // System prompt for storefront chat assistant
    const systemPrompt = `You are ${STORE_DEFAULTS.assistantName}, an AI assistant for ${STORE_DEFAULTS.storeName}, a European print-on-demand store. This is a European store. Prices are in ${STORE_DEFAULTS.currency} (€). Measurements are in ${STORE_DEFAULTS.measurementUnit}. You help customers find and buy products.

${currentLocaleConfig.instruction}

TOOLS AVAILABLE (22 total):
- product_search: Search/browse products (returns product list)
- browse_catalog: Browse products by category with pagination and sorting (newest, topRated, popular, price). Can filter to new arrivals only.
- get_product_detail: Get FULL details for ONE product including materials, care instructions, manufacturing country, print technique, shipping, variants (accepts product name OR ID). Share material and origin info when showing product details.
- compare_products: Compare 2-4 products side-by-side (needs product IDs from search results)
- get_recommendations: Get product recommendations by mode: "top_rated" (default), "new_arrivals" (last 14 days), "popular" (most reviewed). Can filter by category and max price.
- get_size_guide: Get sizing chart for product types (t-shirts, hoodies, etc.)
- check_availability: Check real-time stock availability for a product
- add_to_cart: Add a product to the shopping cart (needs product ID and quantity)
- get_cart: Get current shopping cart contents (shows items, quantities, prices)
- apply_coupon: Apply a discount coupon code to the cart
- estimate_shipping: Calculate shipping cost estimates for different delivery options
- create_checkout: Show checkout confirmation (displays cart summary and asks for approval)
- confirm_checkout: Complete checkout after user approves (creates Stripe session)
- track_order: Track an order by ID or show most recent order status (displays timeline artifact)
- get_order_history: Get user's order history list (displays order list artifact)
- request_return: Request a return/refund for an order (requires approval)
- generate_design: Generate a custom AI design for a product (include intent classification)
- customize_design: Modify an existing design (change colors, add elements)
- remove_background: Remove background from a design image (transparent PNG)
- add_to_wishlist: Add a product to the user's wishlist (requires login)
- get_store_policies: Get store policies (shipping, returns, privacy, terms)
- switch_language: Switch UI language (en, es, de)
- analyze_image: Analyze an uploaded image (only call when user uploads an image)

WHEN TO USE EACH TOOL:
1. User asks to "browse", "search", "show me", "find" products → call product_search
2. User wants to browse by category or see all products → call browse_catalog with optional category filter
3. User asks for "recommendations", "what should I buy", "suggestions" → call get_recommendations
4. User asks for "details", "more info", "materials", "shipping" about a SPECIFIC product → call get_product_detail with the product name
5. User asks to "compare" products → call compare_products with IDs from recent search
6. User asks about "sizing", "size guide", "measurements", "fit" → call get_size_guide
7. User asks "is this in stock", "availability", "can I buy this" → call check_availability
8. User says "add to cart", "add this", "buy this" → call add_to_cart with product ID from context
9. User asks "show my cart", "what's in my cart", "view cart" → call get_cart
10. User says "apply code SAVE10", "use coupon", "discount code" → call apply_coupon
11. User asks "shipping cost", "delivery options", "how much to ship" → call estimate_shipping
12. User says "checkout", "proceed to payment", "buy now" → call create_checkout (shows approval dialog)
13. User confirms checkout approval → call confirm_checkout
14. User asks "track my order", "where's my order", "order status" → call track_order
15. User asks "show my orders", "order history", "past purchases" → call get_order_history
16. User wants to return/refund an order → call request_return (requires approval)
17. User says "design a t-shirt", "create a design", "generate artwork" → call generate_design with intent classification

DESIGN INTENT CLASSIFICATION (for generate_design):
When calling generate_design, classify the user's request into an intent:
- "text-heavy": designs with text/logos/slogans/quotes/typography (e.g., "logo that says COFFEE", "motivational quote t-shirt")
- "photorealistic": photo-quality images (e.g., "realistic mountain landscape", "photographic cat portrait")
- "vector": clean flat design/SVG/icons/minimalist (e.g., "minimalist cat icon", "flat geometric logo")
- "artistic": abstract/creative/painterly (e.g., "surreal dreamscape", "abstract watercolor")
- "pattern": repeating/seamless patterns (e.g., "floral repeating pattern", "geometric tiles")
- "quick-draft": user wants fast preview (e.g., "quick sketch", "rough idea")
- "general": default when unclear

PRIVACY CLASSIFICATION (for generate_design):
- When user uploads a personal photo and asks for caricature/portrait/personalized design → set privacy_level: "personal"
- When user explicitly says "keep this private" or "don't share" → set privacy_level: "private"
- Default: "public" (shown in gallery, usable for marketing)
- Personal designs auto-delete after 30 days and are never shown publicly.

18. User wants to modify existing design: "make it blue", "add stars" → call customize_design
19. User says "remove background", "transparent", "quítale el fondo" → call remove_background with image URL from context
20. User says "add to wishlist", "save for later", "wishlist this" → call add_to_wishlist with product ID
20. User asks "what's your shipping policy", "return policy", "refund policy", "privacy policy" → call get_store_policies
21. User says "switch to Spanish", "habla español", "change to German" → call switch_language with locale
22. User uploads an image → call analyze_image with description of what you see
23. User asks "what's new", "new arrivals", "latest products" → get_recommendations(mode="new_arrivals")
24. User asks "what's popular", "trending", "best sellers" → get_recommendations(mode="popular")
25. User asks "cheapest t-shirts", "sort by price" → browse_catalog(sort="priceLowToHigh", category="...")
26. User says "personalize this", "add my name", "put text on this product", "personalizar esto" → call personalize_product with product ID from context. Generate 3-4 creative text suggestions based on the product type:
  - For mugs: short phrases, names, morning greetings
  - For t-shirts: names, short quotes, fun phrases
  - For hoodies: team names, city names, custom text
  - For tote bags: eco-friendly messages, names, short quotes
  - For posters: quotes, dates, location names

EXAMPLES:
- "show me cat t-shirts" → product_search(query="cat t-shirt")
- "recommend some products for me" → get_recommendations()
- "suggest apparel under €30" → get_recommendations(category="apparel", maxPrice=30)
- "tell me more about the Classic Cat T-Shirt" → get_product_detail(productIdentifier="Classic Cat T-Shirt")
- "compare the cat and dog t-shirts" → compare_products(productIds=[id1, id2])
- "what are the t-shirt sizes?" → get_size_guide(productType="t-shirt")
- "add this to cart" (after showing a product) → add_to_cart(productId="<id from context>", quantity=1)
- "show my cart" → get_cart()
- "apply code SAVE10" → apply_coupon(code="SAVE10")
- "how much is shipping?" → estimate_shipping()
- "checkout" → create_checkout() (will show approval dialog with cart summary)
- "track my order" → track_order() (shows most recent order timeline)
- "track order abc123" → track_order(orderId="abc123")
- "show my orders" → get_order_history() (shows order history list)
- "add to wishlist" (after showing a product) → add_to_wishlist(product_id="<id from context>")
- "what's your return policy?" → get_store_policies()
- "switch to Spanish" → switch_language(locale="es")
- [user uploads image of a cat] → analyze_image(description="A cute orange cat sitting on a windowsill")
- "what's new?" → get_recommendations(mode="new_arrivals")
- "show me popular items" → get_recommendations(mode="popular")
- "cheapest accessories" → browse_catalog(category="accessories", sort="priceLowToHigh")
- "latest apparel" → browse_catalog(category="apparel", sort="newest", newArrivals=true)

IMPORTANT:
- get_product_detail works with product names directly - you don't need to search first!
- You have VISION capabilities - when user uploads an image, you can see it directly
- Call analyze_image tool ONLY when user has uploaded an image to provide structured analysis

WHEN SEARCH RETURNS NO RESULTS (noExactMatch: true):
- Never just say "no products found" — always be helpful and proactive
- Acknowledge what the user was looking for
- Show the suggested alternative products from the "suggestions" field as product cards
- List the available categories from "availableCategories" so the user knows what's in stock
- Suggest browsing by category or trying different search terms
- Example: "I couldn't find T-shirts in our catalog, but we have great hoodies and bags! Here are some popular items you might like: [show suggestions]. Browse our categories: bags (10), mugs (12), hoodies (1)..."

Be friendly, helpful, and concise.`

    // Define tools
    // WORKAROUND: Gemini tool calling has schema bugs in AI SDK 6
    // Using Zod with the simplest possible schema
    const tools = {
      product_search: tool({
        description: 'Search for products in the catalog. Use this for ANY product request: searching, browsing, finding products.',
        parameters: z.object({
          query: z.string().describe('Search keywords. Use 1-2 simple words. Empty string returns all products.'),
        }),
        // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
        execute: async (args: { query: string }) => {
          const { query } = args
          const limit = 8
          try {
            let dbQuery = supabase
              .from('products')
              .select('id, title, description, category, base_price_cents, currency, images, avg_rating, review_count')
              .eq('status', 'active')
              .limit(limit)

            // Full-text search across title, description, and category
            // SECURITY: Sanitize user input to prevent SQL injection
            if (query) {
              const sanitizedQuery = sanitizeForPostgrest(query)
              dbQuery = dbQuery.or(`title.wfts.${sanitizedQuery},description.wfts.${sanitizedQuery},category.wfts.${sanitizedQuery}`)
            }

            const { data: products, error } = await dbQuery

            if (error) {
              console.error('Product search error:', error)
              return { success: false, error: error.message, products: [] }
            }

            const formattedProducts = (products || []).map(formatProduct)

            // Fallback: when no results match, suggest alternatives
            if (formattedProducts.length === 0 && query) {
              const fallback = await getSearchFallback()
              return {
                success: true,
                products: [],
                count: 0,
                query,
                noExactMatch: true,
                suggestions: fallback.suggestions,
                availableCategories: fallback.availableCategories,
                hint: `No products found matching "${query}". Showing top-rated alternatives and available categories. Suggest the user browse these categories or try different search terms.`,
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
              error: error instanceof Error ? error.message : 'Unknown error',
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
              .select('id, title, description, category, base_price_cents, currency, images, avg_rating, review_count', { count: 'exact' })
              .eq('status', 'active')
              .range(offset, offset + limit - 1)

            // Filter by category if provided
            if (category) {
              dbQuery = dbQuery.eq('category', category)
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
              return { success: false, error: error.message, products: [] }
            }

            const formattedProducts = (products || []).map(formatProduct)

            // Fallback: when category filter returns 0 results, suggest alternatives
            if (formattedProducts.length === 0 && category) {
              const fallback = await getSearchFallback()
              return {
                success: true,
                products: [],
                category,
                page,
                totalCount: 0,
                hasMore: false,
                noExactMatch: true,
                suggestions: fallback.suggestions,
                availableCategories: fallback.availableCategories,
                hint: `Category "${category}" has no products. Showing top-rated alternatives. Suggest the user browse available categories.`,
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
              error: error instanceof Error ? error.message : 'Unknown error',
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
                .select('*')
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
                .select('*')
                .eq('status', 'active')
                .or(`title.ilike.${sanitizedIdentifier},description.ilike.${sanitizedIdentifier}`)
                .limit(1)
                .single()

              if (error || !data) {
                return { success: false, error: `Product "${productIdentifier}" not found. Try browsing products first.` }
              }
              product = data
            }

            return {
              success: true,
              product: {
                id: product.id,
                title: product.title,
                description: product.description || 'No description available',
                category: normalizeCategory(product.category),
                price: product.base_price_cents / 100,
                currency: product.currency?.toUpperCase() || 'EUR',
                images: Array.isArray(product.images) ? product.images : [],
                rating: product.avg_rating || 0,
                reviewCount: product.review_count || 0,
                variants: product.variants || [],
                materials: product.product_details?.material || null,
                careInstructions: product.product_details?.care_instructions || null,
                printTechnique: product.product_details?.print_technique || null,
                manufacturingCountry: product.product_details?.manufacturing_country || null,
                brand: product.product_details?.brand || null,
                safetyInformation: product.product_details?.safety_information || null,
                shippingInfo: `Free shipping on orders over €${STORE_DEFAULTS.freeShippingThreshold}. Made to order in ${product.product_details?.manufacturing_country || 'EU'}.`,
                available: true,  // POD = always available (made to order)
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
              .select('*')
              .in('id', ids)
              .eq('status', 'active')

            if (error) {
              return { success: false, error: error.message, products: [] }
            }

            return {
              success: true,
              products: (products || []).map((p) => ({
                id: p.id,
                title: p.title,
                category: normalizeCategory(p.category),
                price: p.base_price_cents / 100,
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
              .select('id, title, description, category, base_price_cents, currency, images, avg_rating, review_count, created_at')
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
              dbQuery = dbQuery.ilike('category', `%${category}%`)
            }

            if (maxPrice) {
              dbQuery = dbQuery.lte('base_price_cents', maxPrice * 100)
            }

            const { data: products, error } = await dbQuery

            if (error) {
              return { success: false, error: error.message, products: [] }
            }

            const formattedProducts = (products || []).map(formatProduct)

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
            // Check product exists
            const { data: product, error: productError } = await supabase
              .from('products')
              .select('id, title, variants')
              .eq('id', productId)
              .eq('status', 'active')
              .single()

            if (productError || !product) {
              return { success: false, error: 'Product not found' }
            }

            // For POD products, availability is always "made to order"
            // In a real implementation, this would call Printify API
            // For now, return static availability data
            if (variantId) {
              const variant = Array.isArray(product.variants)
                ? product.variants.find((v: any) => v.id === variantId)
                : null

              if (!variant) {
                return {
                  success: false,
                  error: 'Variant not found. Available variants: ' +
                    (Array.isArray(product.variants) ? product.variants.map((v: any) => v.title).join(', ') : 'none')
                }
              }

              return {
                success: true,
                available: true,
                productId,
                variantId,
                variantTitle: variant.title,
                stockStatus: 'Made to Order',
                estimatedShipping: '3-5 business days',
                message: `✓ ${variant.title} is available for made-to-order production`,
              }
            } else {
              return {
                success: true,
                available: true,
                productId,
                productTitle: product.title,
                stockStatus: 'Made to Order',
                estimatedShipping: '3-5 business days',
                variantsCount: Array.isArray(product.variants) ? product.variants.length : 0,
                message: `✓ ${product.title} is available for made-to-order production`,
              }
            }
          } catch (error) {
            console.error('check_availability error:', error)
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to check availability'
            }
          }
        },
      }),
      add_to_cart: tool({
        description: 'Add a product to the shopping cart. Call this when user wants to add/buy a product.',
        parameters: z.object({
          productId: z.string().describe('Product ID (UUID) to add to cart'),
          quantity: z.number().optional().describe('Quantity to add (default: 1)'),
        }),
        // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
        execute: async (args: { productId: string; quantity?: number }) => {
          const { productId, quantity = 1 } = args
          try {
            // Use the browser's cart session (shared with /cart page)
            const sessionId = cartSessionId || crypto.randomUUID()

            // Check if product exists
            const { data: product, error: productError } = await supabase
              .from('products')
              .select('id, title, base_price_cents')
              .eq('id', productId)
              .eq('status', 'active')
              .single()

            if (productError || !product) {
              return { success: false, error: 'Product not found' }
            }

            // Check if item already exists in this cart (merge quantities)
            const existingQuery = supabase
              .from('cart_items')
              .select('id, quantity')
              .eq('product_id', productId)

            if (chatUserId) {
              existingQuery.eq('user_id', chatUserId)
            } else {
              existingQuery.eq('session_id', sessionId)
            }

            const { data: existingItems } = await existingQuery

            if (existingItems && existingItems.length > 0) {
              // Update existing item quantity (capped at 99)
              const existing = existingItems[0]
              const newQty = Math.min(existing.quantity + quantity, STORE_DEFAULTS.maxCartQuantity)
              await supabase
                .from('cart_items')
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
            } else {
              // Insert new cart item linked to user's session
              const { error: insertError } = await supabase
                .from('cart_items')
                .insert({
                  product_id: productId,
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
              const orderQuery = supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)

              // If user is authenticated, restrict to their own orders
              if (chatUserId) {
                orderQuery.eq('user_id', chatUserId)
              }

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
          // Gemini sometimes sends "design_description" instead of "prompt" — accept both
          const promptText = args.prompt || args.design_description || 'custom design'
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
                  : 'Daily design limit reached. Upgrade for more.',
                requiresAuth: tier === 'anonymous',
                requiresUpgrade: tier === 'free',
              }
            }

            const result = await generateDesign({
              prompt: promptText,
              style,
              intent: args.intent as DesignIntent | undefined,
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
            let finalImageUrl = result.imageUrl!
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
                  : 'Daily design limit reached. Upgrade for more.',
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
            const result = await generateDesign({ prompt: modifications, style: 'customized' })

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
    }

    // RAG Pipeline Integration
    // Extract the latest user message for semantic search
    let ragContext = ''
    try {
      // Get the last user message
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()

      if (lastUserMessage) {
        // Extract text from the message parts
        let userQuery = ''
        if (Array.isArray(lastUserMessage.parts)) {
          const textParts = lastUserMessage.parts.filter((p: any) => p.type === 'text')
          userQuery = textParts.map((p: any) => p.text).join(' ')
        } else if (lastUserMessage.content) {
          userQuery = lastUserMessage.content
        }

        if (userQuery && userQuery.trim().length > 0) {
          // Call RAG search to get relevant documents
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          const ragResponse = await fetch(
            `${baseUrl}/api/rag/search`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: userQuery,
                locale: chatLocale,
                limit: 3,
              }),
            }
          )

          if (ragResponse.ok) {
            const ragData = await ragResponse.json()

            if (ragData.results && ragData.results.length > 0) {
              // Build context string from top results
              ragContext = '\n\nRELEVANT CONTEXT FROM KNOWLEDGE BASE:\n'
              ragData.results.forEach((doc: any, idx: number) => {
                ragContext += `\n[${idx + 1}] ${doc.content}`
                if (doc.metadata?.source_type === 'product') {
                  ragContext += ` (Product: ${doc.metadata.title || 'Unknown'})`
                }
              })
              ragContext += '\n\nUse the above context to provide accurate, specific answers about our products and policies.\n'
            }
          }
        }
      }
    } catch (ragError) {
      console.error('RAG retrieval error (non-critical):', ragError)
      // Continue without RAG context if it fails
    }

    // Stream response with tools
    // Using gemini-2.5-flash (latest stable as of June 2025)
    // Convert UIMessage format (with parts array) to CoreMessage format (with content string)
    // This is needed because useChat sends UIMessage but streamText expects CoreMessage
    const convertedMessages = await convertToModelMessages(messages, { tools })

    // Inject RAG context into system prompt
    const enhancedSystemPrompt = systemPrompt + ragContext

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: enhancedSystemPrompt,
      messages: convertedMessages,
      tools,
      stopWhen: stepCountIs(5),
      onFinish: async ({ text, toolCalls, toolResults, usage }) => {
        // Persist assistant response
        try {
          await supabase.from('messages').insert({
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            role: 'assistant',
            content: text || '',
            tool_calls: toolCalls?.length ? toolCalls : null,
            tool_results: toolResults?.length ? toolResults : null,
            tokens_used: usage?.totalTokens || null,
            created_at: new Date().toISOString(),
          })

          // Set conversation title from first assistant response
          if (messages.length <= 2 && text) {
            const title = text.substring(0, 100)
            await supabase.from('conversations')
              .update({ title, updated_at: new Date().toISOString() })
              .eq('id', conversationId)
          }
        } catch (err) {
          console.error('Assistant message save error (non-critical):', err)
        }
      },
    })

    // Return streaming SSE response with conversation ID header
    return result.toUIMessageStreamResponse({
      headers: {
        'x-conversation-id': conversationId,
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return Response.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
