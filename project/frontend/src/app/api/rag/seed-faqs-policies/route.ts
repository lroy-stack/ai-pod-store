import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Seed RAG documents with FAQ and policy content
 * GET /api/rag/seed-faqs-policies
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

    // FAQ entries
    const faqDocuments = [
      {
        content: 'How long does shipping take? Standard shipping takes 5-7 business days within Europe. Express shipping is available for 2-3 business days delivery. Free shipping on orders over €50.',
        source_type: 'faq',
        source_id: null,
        locale: 'en',
        metadata: { question: 'How long does shipping take?', category: 'shipping' },
      },
      {
        content: 'What is your return policy? We accept returns within 30 days of delivery. Items must be unworn, unwashed, and in original condition with tags attached. Refunds are processed within 5-7 business days.',
        source_type: 'faq',
        source_id: null,
        locale: 'en',
        metadata: { question: 'What is your return policy?', category: 'returns' },
      },
      {
        content: 'What payment methods do you accept? We accept all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, and Google Pay. All payments are processed securely through Stripe.',
        source_type: 'faq',
        source_id: null,
        locale: 'en',
        metadata: { question: 'What payment methods do you accept?', category: 'payment' },
      },
      {
        content: 'Can I track my order? Yes! Once your order ships, you will receive an email with a tracking number. You can track your order status in the Orders section of your account.',
        source_type: 'faq',
        source_id: null,
        locale: 'en',
        metadata: { question: 'Can I track my order?', category: 'orders' },
      },
      {
        content: 'Are your products eco-friendly? Yes! We use sustainable print-on-demand manufacturing to reduce waste. Products are only printed after you order them. We use water-based inks and organic cotton when available.',
        source_type: 'faq',
        source_id: null,
        locale: 'en',
        metadata: { question: 'Are your products eco-friendly?', category: 'sustainability' },
      },
    ]

    // Policy documents
    const policyDocuments = [
      {
        content: 'Shipping Policy: We offer worldwide shipping. Standard shipping (5-7 business days) is free on orders over €50. Express shipping (2-3 business days) costs €9.99. Orders are processed within 1-2 business days. You will receive a tracking number once your order ships.',
        source_type: 'policy',
        source_id: null,
        locale: 'en',
        metadata: { policy_type: 'shipping' },
      },
      {
        content: 'Return Policy: We want you to love your purchase! Returns are accepted within 30 days of delivery. Items must be unworn, unwashed, and in original condition with tags attached. Custom or personalized items cannot be returned. Refunds are issued to the original payment method within 5-7 business days after we receive your return.',
        source_type: 'policy',
        source_id: null,
        locale: 'en',
        metadata: { policy_type: 'returns' },
      },
      {
        content: 'Privacy Policy: We collect minimal personal information (name, email, shipping address) to process your orders. We never sell your data to third parties. Your payment information is securely processed by Stripe and never stored on our servers. You can request deletion of your account and data at any time.',
        source_type: 'policy',
        source_id: null,
        locale: 'en',
        metadata: { policy_type: 'privacy' },
      },
      {
        content: 'Refund Policy: Refunds are processed within 5-7 business days after we receive your return. Shipping costs are non-refundable unless the item was defective or incorrect. If you received a damaged or incorrect item, please contact us within 48 hours of delivery for a full refund including shipping.',
        source_type: 'policy',
        source_id: null,
        locale: 'en',
        metadata: { policy_type: 'refunds' },
      },
    ]

    const allDocuments = [...faqDocuments, ...policyDocuments]

    const results = []
    for (const doc of allDocuments) {
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
            parts: [{ text: doc.content }],
          },
          outputDimensionality: 768,
        }),
      })

      if (!embeddingResponse.ok) {
        results.push({ type: doc.source_type, success: false, error: 'Embedding failed' })
        continue
      }

      const embeddingData = await embeddingResponse.json()
      const embedding = embeddingData.embedding?.values || []

      // Insert document with embedding
      const { error: insertError } = await supabaseAdmin
        .from('documents')
        .insert({
          ...doc,
          embedding,
        })

      if (insertError) {
        // Check for duplicate key violation (document already exists)
        if (insertError.code === '23505') {
          results.push({ type: doc.source_type, content: doc.content.substring(0, 50), success: true, note: 'Already exists' })
        } else {
          results.push({ type: doc.source_type, content: doc.content.substring(0, 50), success: false, error: insertError.message })
        }
      } else {
        results.push({ type: doc.source_type, content: doc.content.substring(0, 50), success: true })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const faqCount = results.filter((r) => r.type === 'faq' && r.success).length
    const policyCount = results.filter((r) => r.type === 'policy' && r.success).length

    return NextResponse.json({
      success: true,
      message: `Seeded ${successCount}/${allDocuments.length} documents (${faqCount} FAQs, ${policyCount} policies)`,
      results,
      summary: {
        faq: faqCount,
        policy: policyCount,
        total: successCount,
      },
    })
  } catch (error: any) {
    console.error('Seed FAQs/policies error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
