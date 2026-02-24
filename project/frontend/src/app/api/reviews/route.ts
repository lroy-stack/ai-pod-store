import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

// Server-side Supabase client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, rating, comment, imageUrls = [] } = body

    // Get authenticated user from session
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value
    const refreshToken = cookieStore.get('sb-refresh-token')?.value

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to submit a review' },
        { status: 401 }
      )
    }

    // Create Supabase client with user session
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid session' },
        { status: 401 }
      )
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

    // Delete any existing review from this user for this product (to bypass unique constraint)
    await supabaseAdmin
      .from('product_reviews')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', user.id)

    // Insert the new review
    const { data: review, error: insertError} = await supabaseAdmin
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

    return NextResponse.json(
      {
        success: true,
        review,
        message: 'Review submitted successfully',
      },
      { status: 201 }
    )
  } catch (error) {
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

    return NextResponse.json({ reviews }, { status: 200 })
  } catch (error) {
    console.error('Review fetch error:', error)
    return NextResponse.json(
      { error: 'Server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
