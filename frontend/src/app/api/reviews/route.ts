import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { reviewLimiter } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const body = await request.json()
    const { productId, rating, comment, imageUrls = [] } = body

    // Rate limit check
    const { success } = reviewLimiter.check(`review:${user.id}`)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // Validation
    if (!productId || !rating || !comment) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'Product ID, rating, and comment are required' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Invalid rating', message: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    if (comment.trim().length < 10) {
      return NextResponse.json(
        { error: 'Comment too short', message: 'Review must be at least 10 characters' },
        { status: 400 }
      )
    }

    if (imageUrls.length > 3) {
      return NextResponse.json(
        { error: 'Too many photos', message: 'Maximum 3 photos allowed' },
        { status: 400 }
      )
    }

    // Check if user has purchased this product
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('items->>product_id', productId)
      .eq('status', 'completed')
      .limit(1)

    const isVerifiedPurchase = orders && orders.length > 0
    const orderId = isVerifiedPurchase ? orders[0].id : null

    // Delete any existing review from this user for this product (upsert behavior)
    await supabaseAdmin
      .from('product_reviews')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', user.id)

    // Insert the new review
    const { data: review, error: insertError } = await supabaseAdmin
      .from('product_reviews')
      .insert([
        {
          product_id: productId,
          user_id: user.id,
          rating,
          body: comment.trim(),
          is_verified_purchase: isVerifiedPurchase,
          order_id: orderId,
          image_urls: imageUrls,
        },
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Supabase insert error:', insertError)
      return NextResponse.json(
        { error: 'Database error', message: 'Failed to save review' },
        { status: 500 }
      )
    }

    // Award 1 credit for first review per product (idempotent)
    try {
      const { data: existingCredit } = await supabaseAdmin
        .from('credit_transactions')
        .select('id')
        .eq('user_id', user.id)
        .like('reason', `review_reward:${productId}`)
        .limit(1)
        .single()

      if (!existingCredit) {
        await supabaseAdmin.rpc('add_credits', { p_user_id: user.id, p_amount: 1 })

        const { data: profile } = await supabaseAdmin
          .from('users')
          .select('credit_balance')
          .eq('id', user.id)
          .single()

        await supabaseAdmin.from('credit_transactions').insert({
          user_id: user.id,
          amount: 1,
          type: 'earned',
          reason: `review_reward:${productId}`,
          balance_after: profile?.credit_balance ?? 1,
        })
      }
    } catch (creditError) {
      console.error('Credit award error (non-critical):', creditError)
    }

    return NextResponse.json(
      {
        success: true,
        review,
        message: 'Review submitted successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Review submission error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId', message: 'Product ID is required' },
        { status: 400 }
      )
    }

    const { data: reviews, error } = await supabaseAdmin
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase fetch error:', error)
      return NextResponse.json(
        { error: 'Database error', message: 'Failed to fetch reviews' },
        { status: 500 }
      )
    }

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('Review fetch error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
