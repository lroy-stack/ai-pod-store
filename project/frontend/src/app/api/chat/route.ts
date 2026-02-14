import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'
export const maxDuration = 60

// Initialize Google AI with API key
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
})

// Initialize Supabase client for database access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

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
    // Parse cookies from request headers (Edge runtime compatible)
    const cookieHeader = req.headers.get('cookie') || ''
    const cookieMap = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [key, ...val] = c.trim().split('=')
        return [key, val.join('=')]
      })
    )
    const cartSessionId = cookieMap['cart-session-id'] || null
    const sbAccessToken = cookieMap['sb-access-token'] || null

    // Resolve user ID from Supabase auth token (if logged in)
    let chatUserId: string | null = null
    if (sbAccessToken) {
      const { data: { user } } = await supabase.auth.getUser(sbAccessToken)
      chatUserId = user?.id || null
    }

    const body = await req.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: 'Invalid request: messages array required' },
        { status: 400 }
      )
    }

    // System prompt for PodClaw conversational assistant
    const systemPrompt = `You are PodClaw, an AI assistant for a print-on-demand store. You help customers find and buy products.

TOOLS AVAILABLE:
- product_search: Search/browse products (returns product list)
- get_product_detail: Get FULL details for ONE product including materials, shipping, variants (accepts product name OR ID)
- compare_products: Compare 2-4 products side-by-side (needs product IDs from search results)
- get_recommendations: Get personalized product recommendations (can filter by category and max price)
- get_size_guide: Get sizing chart for product types (t-shirts, hoodies, etc.)
- add_to_cart: Add a product to the shopping cart (needs product ID and quantity)
- get_cart: Get current shopping cart contents (shows items, quantities, prices)
- apply_coupon: Apply a discount coupon code to the cart
- estimate_shipping: Calculate shipping cost estimates for different delivery options
- create_checkout: Show checkout confirmation (displays cart summary and asks for approval)
- confirm_checkout: Complete checkout after user approves (creates Stripe session)

WHEN TO USE EACH TOOL:
1. User asks to "browse", "search", "show me", "find" products → call product_search
2. User asks for "recommendations", "what should I buy", "suggestions" → call get_recommendations
3. User asks for "details", "more info", "materials", "shipping" about a SPECIFIC product → call get_product_detail with the product name
4. User asks to "compare" products → call compare_products with IDs from recent search
5. User asks about "sizing", "size guide", "measurements", "fit" → call get_size_guide
6. User says "add to cart", "add this", "buy this" → call add_to_cart with product ID from context
7. User asks "show my cart", "what's in my cart", "view cart" → call get_cart
8. User says "apply code SAVE10", "use coupon", "discount code" → call apply_coupon
9. User asks "shipping cost", "delivery options", "how much to ship" → call estimate_shipping
10. User says "checkout", "proceed to payment", "buy now" → call create_checkout (shows approval dialog)

EXAMPLES:
- "show me cat t-shirts" → product_search(query="cat t-shirt")
- "recommend some products for me" → get_recommendations()
- "suggest apparel under $30" → get_recommendations(category="apparel", maxPrice=30)
- "tell me more about the Classic Cat T-Shirt" → get_product_detail(productIdentifier="Classic Cat T-Shirt")
- "compare the cat and dog t-shirts" → compare_products(productIds=[id1, id2])
- "what are the t-shirt sizes?" → get_size_guide(productType="t-shirt")
- "add this to cart" (after showing a product) → add_to_cart(productId="<id from context>", quantity=1)
- "show my cart" → get_cart()
- "apply code SAVE10" → apply_coupon(code="SAVE10")
- "how much is shipping?" → estimate_shipping()
- "checkout" → create_checkout() (will show approval dialog with cart summary)

IMPORTANT: get_product_detail works with product names directly - you don't need to search first!

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
            if (query) {
              dbQuery = dbQuery.or(`title.wfts.${query},description.wfts.${query},category.wfts.${query}`)
            }

            const { data: products, error } = await dbQuery

            if (error) {
              console.error('Product search error:', error)
              return { success: false, error: error.message, products: [] }
            }

            const formattedProducts = (products || []).map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description?.substring(0, 150) + (p.description?.length > 150 ? '...' : ''),
              category: p.category,
              price: p.base_price_cents / 100,
              currency: p.currency?.toUpperCase() || 'EUR',
              image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : null,
              rating: p.avg_rating || 0,
              reviewCount: p.review_count || 0,
            }))

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
              const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('status', 'active')
                .or(`title.ilike.%${productIdentifier}%,description.ilike.%${productIdentifier}%`)
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
                category: product.category,
                price: product.base_price_cents / 100,
                currency: product.currency?.toUpperCase() || 'EUR',
                images: Array.isArray(product.images) ? product.images : [],
                rating: product.avg_rating || 0,
                reviewCount: product.review_count || 0,
                variants: product.variants || [],
                materials: product.materials || null,
                shippingInfo: 'Free shipping on orders over $50',
                available: product.stock_quantity > 0,
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
                category: p.category,
                price: p.base_price_cents / 100,
                currency: p.currency?.toUpperCase() || 'EUR',
                image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : null,
                rating: p.avg_rating || 0,
                reviewCount: p.review_count || 0,
                available: p.stock_quantity > 0,
                features: p.features || [],
              })),
            }
          } catch (error) {
            return { success: false, error: 'Failed to compare products', products: [] }
          }
        },
      }),
      get_recommendations: tool({
        description: 'Get personalized product recommendations based on category, price range, or user preferences.',
        parameters: z.object({
          category: z.string().optional().describe('Product category to filter by (e.g., "apparel", "accessories")'),
          maxPrice: z.number().optional().describe('Maximum price in USD'),
        }),
        // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
        execute: async (args: { category?: string; maxPrice?: number }) => {
          const { category, maxPrice } = args
          const limit = 6
          try {
            let dbQuery = supabase
              .from('products')
              .select('id, title, description, category, base_price_cents, currency, images, avg_rating, review_count')
              .eq('status', 'active')
              .limit(limit)
              .order('avg_rating', { ascending: false })

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

            const formattedProducts = (products || []).map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description?.substring(0, 150) + (p.description?.length > 150 ? '...' : ''),
              category: p.category,
              price: p.base_price_cents / 100,
              currency: p.currency?.toUpperCase() || 'EUR',
              image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : null,
              rating: p.avg_rating || 0,
              reviewCount: p.review_count || 0,
            }))

            return {
              success: true,
              products: formattedProducts,
              count: formattedProducts.length,
              category: category || 'all',
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
                unit: 'inches',
                sizes: [
                  { size: 'XS', chest: 31, length: 27, width: 16 },
                  { size: 'S', chest: 34, length: 28, width: 18 },
                  { size: 'M', chest: 37, length: 29, width: 20 },
                  { size: 'L', chest: 40, length: 30, width: 22 },
                  { size: 'XL', chest: 43, length: 31, width: 24 },
                  { size: '2XL', chest: 46, length: 32, width: 26 },
                ],
              },
            }
          } else if (lowerType.includes('hoodie') || lowerType.includes('sweatshirt')) {
            return {
              success: true,
              guide: {
                productType: 'Hoodie',
                unit: 'inches',
                sizes: [
                  { size: 'S', chest: 36, length: 27, sleeve: 33 },
                  { size: 'M', chest: 40, length: 28, sleeve: 34 },
                  { size: 'L', chest: 44, length: 29, sleeve: 35 },
                  { size: 'XL', chest: 48, length: 30, sleeve: 36 },
                  { size: '2XL', chest: 52, length: 31, sleeve: 37 },
                ],
              },
            }
          } else {
            // Default generic apparel size guide
            return {
              success: true,
              guide: {
                productType: productType,
                unit: 'inches',
                sizes: [
                  { size: 'S', width: 18, length: 28 },
                  { size: 'M', width: 20, length: 29 },
                  { size: 'L', width: 22, length: 30 },
                  { size: 'XL', width: 24, length: 31 },
                ],
              },
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
              const newQty = Math.min(existing.quantity + quantity, 99)
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
                  : `$${coupon.discount_value} off`
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
          country: z.string().optional().describe('Destination country code (default: "US")'),
        }),
        // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
        execute: async (args: { country?: string }) => {
          const { country = 'US' } = args
          try {
            // Mock shipping estimates based on destination
            // In production, this would call Printify API or shipping provider
            const baseRates = {
              US: [
                { method: 'Standard', price: 4.99, days: '5-7 business days', currency: 'USD' },
                { method: 'Express', price: 14.99, days: '2-3 business days', currency: 'USD' },
                { method: 'Overnight', price: 24.99, days: '1 business day', currency: 'USD' },
              ],
              CA: [
                { method: 'Standard', price: 9.99, days: '7-10 business days', currency: 'USD' },
                { method: 'Express', price: 19.99, days: '3-5 business days', currency: 'USD' },
              ],
              GB: [
                { method: 'Standard', price: 12.99, days: '10-14 business days', currency: 'USD' },
                { method: 'Express', price: 24.99, days: '5-7 business days', currency: 'USD' },
              ],
              EU: [
                { method: 'Standard', price: 14.99, days: '10-14 business days', currency: 'USD' },
                { method: 'Express', price: 29.99, days: '5-7 business days', currency: 'USD' },
              ],
            }

            const rates = baseRates[country as keyof typeof baseRates] || baseRates.US

            return {
              success: true,
              country,
              options: rates,
              freeShippingThreshold: 50,
              message: `Free shipping on orders over $50!`,
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
        // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
        execute: async (args: { customerEmail?: string }) => {
          const { customerEmail } = args
          try {
            // Get cart items from the last 24 hours (demo - in production would use session)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

            const { data: cartItems, error: cartError } = await supabase
              .from('cart_items')
              .select('id, product_id, quantity, created_at')
              .gte('created_at', oneDayAgo)
              .order('created_at', { ascending: false })
              .limit(10)

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
            // Get cart items again (same logic as create_checkout)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

            const { data: cartItems, error: cartError } = await supabase
              .from('cart_items')
              .select('id, product_id, quantity, created_at')
              .gte('created_at', oneDayAgo)
              .order('created_at', { ascending: false })
              .limit(10)

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
                locale: 'en',
                currency: 'usd',
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
    }

    // Stream response with tools
    // Using gemini-2.5-flash (latest stable as of June 2025)
    // Testing if tool calling works better than 2.0
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
    })

    // Return streaming SSE response
    return result.toUIMessageStreamResponse()
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
