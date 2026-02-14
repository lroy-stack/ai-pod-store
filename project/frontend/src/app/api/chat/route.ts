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
    const systemPrompt = `You are PodClaw, an AI assistant for a print-on-demand store. You help customers:
- Find and recommend products (t-shirts, hoodies, mugs, posters, phone cases)
- Answer questions about products, shipping, and returns
- Guide them through the shopping experience
- Provide design suggestions and customization options

IMPORTANT: When the customer asks to see, browse, find, or search for products, you MUST use the product_search tool.
Examples that require the tool:
- "show me cat t-shirts" → use product_search with query="cat t-shirts"
- "I want a hoodie" → use product_search with query="hoodie"
- "what do you have?" → use product_search with query=""

Be friendly, helpful, and concise. Always respond in the user's language.
If you don't know something, be honest and offer to help in other ways.`

    // Define tools
    // WORKAROUND: Gemini tool calling has schema bugs in AI SDK 6
    // Using Zod with the simplest possible schema
    const tools = {
      product_search: tool({
        description: 'Search for products in the catalog. Call this when user asks to see/find/browse products.',
        parameters: z.object({
          query: z.string().describe('Search keywords (e.g. "cat t-shirts", "vintage hoodies")'),
        }),
        // @ts-expect-error AI SDK 6.0.86 type mismatch — execute works at runtime
        execute: async (args: { query: string }) => {
          const { query } = args
          const limit = 6
          console.log('[product_search] Tool executing with query:', query)
          try {
            // Build query
            let dbQuery = supabase
              .from('products')
              .select('id, title, description, category, base_price_cents, images, avg_rating, review_count')
              .eq('status', 'active')
              .limit(Math.min(limit, 12))

            // No filters in simplified version

            // Full-text search using PostgreSQL websearch (handles stemming/plurals)
            if (query) {
              dbQuery = dbQuery.or(`title.wfts.${query},description.wfts.${query}`)
            }

            const { data: products, error } = await dbQuery

            if (error) {
              console.error('Product search error:', error)
              return {
                success: false,
                error: error.message,
                products: [],
              }
            }

            // Format products for display
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
    }

    // Stream response with tools
    // Using gemini-2.5-flash (latest stable as of June 2025)
    // Testing if tool calling works better than 2.0
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(3),
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
