import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Maximum quantity allowed per cart item
const MAX_CART_QUANTITY = 99

// GET /api/cart - Fetch cart items
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sb-access-token')

    // Get session ID for guest carts (fallback)
    let sessionId = cookieStore.get('cart-session-id')?.value
    let needsSessionCookie = false
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      needsSessionCookie = true
    }

    const supabase = supabaseAdmin

    // Try to get user from session
    let userId: string | null = null
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value)
      userId = user?.id || null
    }

    // Fetch cart items (either by user_id or session_id)
    const query = supabase
      .from('cart_items')
      .select('id, product_id, quantity, variant_id, created_at, updated_at')
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

    // Fetch product details for each cart item
    // We need to get product_id list and query products + products_l10n
    const productIds = (cartItems || []).map((item: any) => item.product_id)

    if (productIds.length === 0) {
      const response = NextResponse.json({ items: [] })
      if (needsSessionCookie) {
        response.cookies.set('cart-session-id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        })
      }
      return response
    }

    // Fetch products with their base info
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, title, base_price_cents, currency')
      .in('id', productIds)

    if (productsError) {
      console.error('Products fetch error:', productsError)
      return NextResponse.json(
        { error: 'Failed to fetch products', message: productsError.message },
        { status: 500 }
      )
    }

    // Create a map of product details
    const productMap = new Map(
      (products || []).map((p: any) => [
        p.id,
        {
          title: p.title || 'Unknown Product',
          price: p.base_price_cents ? p.base_price_cents / 100 : 0, // Convert cents to dollars
        },
      ])
    )

    // Transform cart items to include product details
    const items = (cartItems || []).map((item: any) => {
      const productDetails = productMap.get(item.product_id) || {
        title: 'Unknown Product',
        price: 0,
      }

      return {
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        product_title: productDetails.title,
        product_price: productDetails.price,
        variant_details: {}, // TODO: Fetch from product_variants if needed
      }
    })

    const response = NextResponse.json({ items })
    if (needsSessionCookie) {
      response.cookies.set('cart-session-id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }
    return response
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
    let needsSessionCookie = false
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      needsSessionCookie = true
    }

    const supabase = supabaseAdmin

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
      const newQuantity = Math.min(existingItem.quantity + quantity, MAX_CART_QUANTITY)

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

      const response = NextResponse.json({ success: true, updated: true })
      if (needsSessionCookie) {
        response.cookies.set('cart-session-id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        })
      }
      return response
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

    const response = NextResponse.json({ success: true, added: true })
    if (needsSessionCookie) {
      response.cookies.set('cart-session-id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }
    return response
  } catch (error) {
    console.error('Cart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/cart - Update cart item quantity
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sb-access-token')
    const sessionId = cookieStore.get('cart-session-id')?.value

    const supabase = supabaseAdmin

    // Try to get user from session
    let userId: string | null = null
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value)
      userId = user?.id || null
    }

    const body = await request.json()
    const { item_id, quantity } = body

    if (!item_id || typeof quantity !== 'number' || quantity < 0) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'item_id and quantity are required' },
        { status: 400 }
      )
    }

    // Enforce maximum quantity limit
    if (quantity > MAX_CART_QUANTITY) {
      return NextResponse.json(
        { error: 'Quantity exceeds maximum', message: `Maximum quantity is ${MAX_CART_QUANTITY}` },
        { status: 400 }
      )
    }

    // If quantity is 0, delete the item
    if (quantity === 0) {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', item_id)

      if (error) {
        console.error('Cart item delete error:', error)
        return NextResponse.json(
          { error: 'Failed to remove item', message: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, deleted: true })
    }

    // Update quantity
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', item_id)

    if (error) {
      console.error('Cart item update error:', error)
      return NextResponse.json(
        { error: 'Failed to update quantity', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, updated: true })
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

    const supabase = supabaseAdmin

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
