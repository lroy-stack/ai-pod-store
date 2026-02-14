/**
 * DEVELOPMENT ONLY: Simulate Stripe Webhook
 *
 * POST /api/test/simulate-webhook
 * Simulates a Stripe checkout.session.completed event to test order creation
 * This bypasses webhook signature verification for local testing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Only allow in development
if (process.env.NODE_ENV === 'production') {
  throw new Error('This endpoint is for development only')
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json()

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }

    // Fetch session details from Stripe (using the real Stripe client)
    const { stripe } = await import('@/lib/stripe')

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items', 'payment_intent'],
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Extract data from session
    const locale = session.metadata?.locale || 'en'
    const cartItemsStr = session.metadata?.cart_items || '[]'
    const cartItems = JSON.parse(cartItemsStr)
    const lineItems = session.line_items?.data || []
    const customerEmail = session.customer_details?.email || session.customer_email

    // Build shipping address
    const shippingAddress = session.shipping_details?.address
      ? {
          name: session.shipping_details.name,
          line1: session.shipping_details.address.line1,
          line2: session.shipping_details.address.line2,
          city: session.shipping_details.address.city,
          state: session.shipping_details.address.state,
          postal_code: session.shipping_details.address.postal_code,
          country: session.shipping_details.address.country,
        }
      : null

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('stripe_session_id', session_id)
      .single()

    if (existingOrder) {
      return NextResponse.json({
        message: 'Order already exists',
        order_id: existingOrder.id,
      })
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        stripe_session_id: session_id,
        stripe_payment_intent_id: paymentIntentId,
        status: 'paid',
        total_cents: session.amount_total || 0,
        currency: session.currency || 'usd',
        shipping_address: shippingAddress,
        customer_email: customerEmail,
        locale,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (orderError) {
      console.error('Failed to create order:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order', details: orderError.message },
        { status: 500 }
      )
    }

    // Create order items
    const orderItems = lineItems.map((item, index) => {
      const cartItem = cartItems[index] || {}
      return {
        order_id: order.id,
        product_id: cartItem.product_id || null,
        variant_id: cartItem.variant_id || null,
        quantity: item.quantity || 1,
        unit_price_cents: Math.round((item.amount_total || 0) / (item.quantity || 1)),
      }
    })

    const validOrderItems = orderItems.filter((item) => item.product_id)

    if (validOrderItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(validOrderItems)

      if (itemsError) {
        console.error('Failed to create order items:', itemsError)
        return NextResponse.json(
          { error: 'Failed to create order items', details: itemsError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      session_id,
      items_created: validOrderItems.length,
    })
  } catch (error) {
    console.error('Error simulating webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
