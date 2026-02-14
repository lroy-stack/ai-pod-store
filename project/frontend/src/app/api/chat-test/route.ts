import { createClient } from '@supabase/supabase-js'
import { createDataStreamResponse, pipeDataStreamToResponse } from 'ai'

export const runtime = 'edge'

// Initialize Supabase client for database access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * POST /api/chat-test
 *
 * Test endpoint that returns a mock AI SDK response with a product search tool result
 * This allows us to test artifact rendering without the Gemini tool schema bug
 */
export async function POST(req: Request) {
  try {
    // Fetch real products from database
    const { data: products, error } = await supabase
      .from('products')
      .select('id, title, description, category, base_price_cents, images, avg_rating, review_count')
      .eq('status', 'active')
      .limit(6)

    if (error) {
      console.error('Product fetch error:', error)
    }

    // Format products
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

    // Use AI SDK's data stream response builder
    return createDataStreamResponse({
      execute: async (dataStream) => {
        // Write text response
        dataStream.writeData({ type: 'text', content: 'I found some great t-shirts for you! Here\'s what we have:\n\n' })

        // Write tool result as data
        dataStream.writeData({
          type: 'tool-result',
          toolName: 'product_search',
          result: {
            success: true,
            products: formattedProducts,
            count: formattedProducts.length,
            query: 't-shirts',
          },
        })
      },
      onError: (error) => {
        console.error('Stream error:', error)
        return error instanceof Error ? error.message : String(error)
      },
    })
  } catch (error) {
    console.error('Chat test API error:', error)
    return Response.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
