/**
 * Order Reorder API
 *
 * POST /api/orders/:id/reorder
 * Copies all items from an order into the current cart. Requires auth + ownership check.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { STORE_DEFAULTS } from '@/lib/store-config'

const MAX_CART_QUANTITY = STORE_DEFAULTS.maxCartQuantity

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    let user
    try {
      user = await requireAuth(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    const { id } = await params

    // Fetch order with ownership check
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Ownership check: user can only reorder their own orders
    if (order.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Fetch order items
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('product_id, quantity, variant_id')
      .eq('order_id', id)

    if (itemsError) {
      console.error('Error fetching order items:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch order items' },
        { status: 500 }
      )
    }

    if (!orderItems || orderItems.length === 0) {
      return NextResponse.json(
        { error: 'Order has no items' },
        { status: 400 }
      )
    }

    // Get cart session ID for the user (authenticated user)
    const cookieStore = await cookies()
    let sessionId = cookieStore.get('cart-session-id')?.value
    if (!sessionId) {
      sessionId = crypto.randomUUID()
    }

    let itemsAdded = 0
    let itemsUpdated = 0
    let itemsSkipped = 0

    // Add each order item to cart
    for (const item of orderItems) {
      const { product_id, quantity, variant_id } = item

      // Skip items with invalid quantity
      if (!quantity || quantity < 1) {
        itemsSkipped++
        continue
      }

      // Check if item already exists in cart (same product + same variant + same personalization)
      const existingQuery = supabaseAdmin
        .from('cart_items')
        .select('*')
        .eq('product_id', product_id)
        .eq('user_id', user.id)

      if (variant_id) {
        existingQuery.eq('variant_id', variant_id)
      } else {
        existingQuery.is('variant_id', null)
      }

      // Note: Personalizations are not copied during reorder
      // Users must re-personalize items if needed
      existingQuery.is('personalization_id', null)

      const { data: existingItems } = await existingQuery

      if (existingItems && existingItems.length > 0) {
        // Update quantity if item already exists
        const existingItem = existingItems[0]
        const newQuantity = Math.min(existingItem.quantity + quantity, MAX_CART_QUANTITY)

        const { error: updateError } = await supabaseAdmin
          .from('cart_items')
          .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
          .eq('id', existingItem.id)

        if (updateError) {
          console.error('Cart update error:', updateError)
          itemsSkipped++
        } else {
          itemsUpdated++
        }
      } else {
        // Insert new cart item
        const cartItem: any = {
          product_id,
          quantity,
          user_id: user.id,
          session_id: null, // Authenticated users don't need session_id
          ...(variant_id ? { variant_id } : {}),
          // Note: personalization_id is NOT copied - users must re-personalize
        }

        const { error: insertError } = await supabaseAdmin
          .from('cart_items')
          .insert(cartItem)

        if (insertError) {
          console.error('Cart insert error:', insertError)
          itemsSkipped++
        } else {
          itemsAdded++
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order items copied to cart',
      items_added: itemsAdded,
      items_updated: itemsUpdated,
      items_skipped: itemsSkipped,
      total_items: orderItems.length,
    })
  } catch (error) {
    console.error('Error reordering:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
