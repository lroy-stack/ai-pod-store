import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// GET /api/cart - Fetch cart items
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sb-access-token')

    // Get session ID for guest carts (fallback)
    let sessionId = cookieStore.get('cart-session-id')?.value
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      cookieStore.set('cart-session-id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Try to get user from session
    let userId: string | null = null
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value)
      userId = user?.id || null
    }

    // Fetch cart items (either by user_id or session_id)
    const query = supabase
      .from('cart_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (userId) {
      query.eq('user_id', userId)
    } else {
      query.eq('session_id', sessionId)
    }

    const { data: cartItems, error } = await query

    if (error) {
      console.error('Cart fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cart', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ items: cartItems || [] })
  } catch (error) {
    console.error('Cart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/cart - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sb-access-token')

    // Get session ID for guest carts
    let sessionId = cookieStore.get('cart-session-id')?.value
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      cookieStore.set('cart-session-id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Try to get user from session
    let userId: string | null = null
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value)
      userId = user?.id || null
    }

    const body = await request.json()
    const { product_id, quantity, variant_details } = body

    if (!product_id || !quantity || quantity < 1) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'product_id and quantity are required' },
        { status: 400 }
      )
    }

    // Check if item already exists in cart
    const existingQuery = supabase
      .from('cart_items')
      .select('*')
      .eq('product_id', product_id)

    if (userId) {
      existingQuery.eq('user_id', userId)
    } else {
      existingQuery.eq('session_id', sessionId)
    }

    const { data: existingItems } = await existingQuery

    if (existingItems && existingItems.length > 0) {
      // Update quantity if item already exists
      const existingItem = existingItems[0]
      const newQuantity = existingItem.quantity + quantity

      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', existingItem.id)

      if (updateError) {
        console.error('Cart update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update cart', message: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, updated: true })
    }

    // Insert new cart item
    const cartItem: any = {
      product_id,
      quantity,
      session_id: userId ? null : sessionId,
      user_id: userId,
    }

    // Note: variant_id would be used if we have a proper product_variants table
    // For now, we're using mock data so variant_id is not set

    const { error: insertError } = await supabase
      .from('cart_items')
      .insert(cartItem)

    if (insertError) {
      console.error('Cart insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to add to cart', message: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, added: true })
  } catch (error) {
    console.error('Cart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/cart - Clear all cart items
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sb-access-token')
    const sessionId = cookieStore.get('cart-session-id')?.value

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Try to get user from session
    let userId: string | null = null
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value)
      userId = user?.id || null
    }

    // Delete cart items
    const deleteQuery = supabase.from('cart_items').delete()

    if (userId) {
      deleteQuery.eq('user_id', userId)
    } else if (sessionId) {
      deleteQuery.eq('session_id', sessionId)
    } else {
      return NextResponse.json({ error: 'No cart found' }, { status: 404 })
    }

    const { error } = await deleteQuery

    if (error) {
      console.error('Cart delete error:', error)
      return NextResponse.json(
        { error: 'Failed to clear cart', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
