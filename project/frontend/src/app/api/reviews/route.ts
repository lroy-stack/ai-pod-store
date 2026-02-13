import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Server-side Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, rating, comment } = body

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

    // For now, we'll use the test user - in production this would come from the session
    const mockUserId = '00000000-0000-0000-0000-000000000001'

    // Delete any existing review from this user for this product (to bypass unique constraint)
    await supabase
      .from('product_reviews')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', mockUserId)
      .is('order_id', null)

    // Insert the new review
    const { data: review, error: insertError} = await supabase
      .from('product_reviews')
      .insert([
        {
          product_id: productId,
          user_id: mockUserId,
          rating,
          body: comment.trim(),
          is_verified_purchase: false,
          order_id: null,
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

    const { data: reviews, error } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
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
