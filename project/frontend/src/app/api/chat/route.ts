import { streamText, tool, zodSchema } from 'ai'
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

When searching for products, use the product_search tool to find items matching the customer's request.
Be friendly, helpful, and concise. Always respond in the user's language.
If you don't know something, be honest and offer to help in other ways.`

    // Convert UI messages (with parts array) to model messages
    // UI messages have { role, parts: [{ type: 'text', text: '...' }], id }
    // Model messages need { role, content: '...' }
    const modelMessages = messages.map((msg: any) => {
      // Extract text from parts array
      const textParts = msg.parts.filter((p: any) => p.type === 'text')
      const content = textParts.map((p: any) => p.text).join('\n')

      return {
        role: msg.role,
        content,
      }
    })

    // Define tools
    const tools = {
      // @ts-ignore - AI SDK tool type inference issue
      product_search: tool({
        description: 'Search for products in the catalog. Use this when customers ask for specific items like "cat t-shirts", "hoodies", "mugs with dogs", etc.',
        parameters: zodSchema(z.object({
          query: z.string().describe('The search query (e.g., "cat t-shirts", "blue hoodie")'),
          category: z.string().optional().describe('Filter by category (apparel, drinkware, home-decor, accessories)'),
          minPrice: z.number().optional().describe('Minimum price in cents'),
          maxPrice: z.number().optional().describe('Maximum price in cents'),
          limit: z.number().default(6).describe('Number of results to return (max 12)'),
        })),
        execute: async (args) => {
          const { query, category, minPrice, maxPrice, limit } = args
          try {
            // Build query
            let dbQuery = supabase
              .from('products')
              .select('id, title, description, category, base_price_cents, images, avg_rating, review_count')
              .eq('status', 'active')
              .limit(Math.min(limit, 12))

            // Apply filters
            if (category) {
              dbQuery = dbQuery.eq('category', category)
            }
            if (minPrice !== undefined) {
              dbQuery = dbQuery.gte('base_price_cents', minPrice)
            }
            if (maxPrice !== undefined) {
              dbQuery = dbQuery.lte('base_price_cents', maxPrice)
            }

            // Simple text search (future: semantic search with embeddings)
            if (query) {
              dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`)
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
    const result = streamText({
      model: google('gemini-2.0-flash'),
      system: systemPrompt,
      messages: modelMessages,
      tools,
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
