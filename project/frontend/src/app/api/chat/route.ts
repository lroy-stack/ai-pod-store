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

WHEN TO USE EACH TOOL:
1. User asks to "browse", "search", "show me", "find" products → call product_search
2. User asks for "details", "more info", "materials", "shipping", "tell me about" a SPECIFIC product → call get_product_detail with the product name
3. User asks to "compare" products → call compare_products with IDs from recent search

EXAMPLES:
- "show me cat t-shirts" → product_search(query="cat t-shirt")
- "tell me more about the Classic Cat T-Shirt" → get_product_detail(productIdentifier="Classic Cat T-Shirt")
- "what materials is the hoodie made of?" → get_product_detail(productIdentifier="hoodie")
- "shipping info for Dog Lover T-Shirt" → get_product_detail(productIdentifier="Dog Lover T-Shirt")
- "compare the first two products" → compare_products(productIds=[id1, id2])

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
    }

    // Stream response with tools
    // Using gemini-2.5-flash (latest stable as of June 2025)
    // Testing if tool calling works better than 2.0
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      maxSteps: 5,
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
