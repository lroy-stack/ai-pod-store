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
- product_search: Search/browse products (returns product list with IDs)
- get_product_detail: Get full details for ONE specific product (needs product ID)
- compare_products: Compare 2-4 products side-by-side (needs array of product IDs)

WORKFLOW:
1. When user asks to browse/search → call product_search
2. When user asks for DETAILS, MATERIALS, SHIPPING, or FULL INFO about a product → FIRST call product_search to find the ID, THEN immediately call get_product_detail with that ID
3. When user asks to COMPARE products → FIRST search to get IDs if needed, THEN call compare_products

EXAMPLES:
- "show me cat t-shirts" → product_search(query="cat t-shirt")
- "details about Classic Cat T-Shirt" or "materials and shipping for Classic Cat T-Shirt" → product_search(query="classic cat t-shirt"), THEN get_product_detail(productId)
- "compare cat t-shirt and phone case" → compare_products(productIds from recent search)

CRITICAL: When user mentions "details", "materials", "shipping", "full information", you MUST call get_product_detail!

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
              .select('id, title, description, category, base_price_cents, images, avg_rating, review_count')
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
              currency: 'USD',
              image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0].src : null,
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
        description: 'Get detailed information about a specific product. Call this when user asks to see details, learn more, or get info about a product.',
        parameters: z.object({
          productId: z.string().describe('Product ID to get details for'),
        }),
        // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
        execute: async (args: { productId: string }) => {
          const { productId } = args
          try {
            const { data: product, error } = await supabase
              .from('products')
              .select('*')
              .eq('id', productId)
              .eq('status', 'active')
              .single()

            if (error || !product) {
              return { success: false, error: 'Product not found' }
            }

            return {
              success: true,
              product: {
                id: product.id,
                title: product.title,
                description: product.description || 'No description available',
                category: product.category,
                price: product.base_price_cents / 100,
                currency: 'USD',
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
                currency: 'USD',
                image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0].src : null,
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
