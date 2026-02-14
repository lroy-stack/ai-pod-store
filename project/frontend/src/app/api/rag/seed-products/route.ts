import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Seed RAG documents from existing products
 * GET /api/rag/seed-products
 */
export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Fetch active products
    const { data: products, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('id, title, description, category, base_price_cents, avg_rating, review_count')
      .eq('status', 'active')
      .limit(15)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch products', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No products found',
      })
    }

    // Create documents for each product
    const results = []
    for (const product of products) {
      const content = `${product.title}: ${product.description || 'No description'}. Price: €${product.base_price_cents / 100}. Category: ${product.category}. Rating: ${product.avg_rating || 0}/5 (${product.review_count || 0} reviews).`

      // Generate embedding
      const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

      const embeddingResponse = await fetch(embeddingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [{ text: content }],
          },
          outputDimensionality: 768,
        }),
      })

      if (!embeddingResponse.ok) {
        results.push({ product: product.title, success: false, error: 'Embedding failed' })
        continue
      }

      const embeddingData = await embeddingResponse.json()
      const embedding = embeddingData.embedding?.values || []

      // Insert document with embedding
      const { error: insertError } = await supabaseAdmin
        .from('documents')
        .insert({
          content,
          source_type: 'product',
          source_id: product.id,
          locale: 'en',
          embedding,
          metadata: {
            title: product.title,
            category: product.category,
            price: product.base_price_cents / 100,
          },
        })

      if (insertError) {
        // Check for duplicate key violation (document already exists)
        if (insertError.code === '23505') {
          results.push({ product: product.title, success: true, note: 'Already exists' })
        } else {
          results.push({ product: product.title, success: false, error: insertError.message })
        }
      } else {
        results.push({ product: product.title, success: true })
      }
    }

    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      success: true,
      message: `Seeded ${successCount}/${products.length} product documents`,
      results,
    })
  } catch (error: any) {
    console.error('Seed products error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
