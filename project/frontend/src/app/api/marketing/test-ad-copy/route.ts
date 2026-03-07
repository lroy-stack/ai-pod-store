import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'


const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

/**
 * Test endpoint to create sample ad copy for verification
 * Simulates what the marketing agent should be creating
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await requireAdmin(request)
  } catch (err) {
    return authErrorResponse(err)
  }


  try {
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get top 3 products to create ad copy for
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, title')
      .eq('status', 'active')
      .limit(3)

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No products found' }, { status: 404 })
    }

    const adCopyToCreate = []

    for (const product of products) {
      // Google Ads format: 30 char headline + 90 char description
      const googleAd = {
        platform: 'google_ads',
        product_id: product.id,
        copy: `${product.title} - Shop Now`, // Headline (max 30 chars)
        cta: 'Shop Now',
        alt_text: `${product.title} product image`,
        status: 'draft',
        locale: 'en'
      }

      // Verify Google Ads headline is max 30 characters
      if (googleAd.copy.length > 30) {
        googleAd.copy = googleAd.copy.substring(0, 27) + '...'
      }

      adCopyToCreate.push(googleAd)

      // Meta Ads format: 125 char primary text
      const metaAd = {
        platform: 'meta_ads',
        product_id: product.id,
        copy: `Discover ${product.title}. Premium quality, unique designs. Order today for fast shipping!`, // Primary text (max 125 chars)
        cta: 'Learn More',
        alt_text: `${product.title} lifestyle image`,
        status: 'draft',
        locale: 'en'
      }

      // Verify Meta Ads primary text is max 125 characters
      if (metaAd.copy.length > 125) {
        metaAd.copy = metaAd.copy.substring(0, 122) + '...'
      }

      adCopyToCreate.push(metaAd)
    }

    // Insert all ad copy
    const { data: insertedAds, error: insertError } = await supabase
      .from('marketing_content')
      .insert(adCopyToCreate)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Created ${adCopyToCreate.length} ad copies for ${products.length} products`,
      ads: insertedAds,
      products: products.map(p => p.title)
    })
  } catch (err) {
    console.error('Error creating test ad copy:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
