/**
 * Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events (checkout.session.completed, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { printify, buildPrintifyAddress } from '@/lib/printify'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Initialize Supabase client with service role key for webhook
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
      break

    case 'payment_intent.succeeded':
      // Future: handle payment intent succeeded
      console.log('PaymentIntent succeeded:', event.data.object.id)
      break

    case 'payment_intent.payment_failed':
      // Future: handle payment failure
      console.log('PaymentIntent failed:', event.data.object.id)
      break

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}

/**
 * Handle checkout.session.completed event
 * Creates an order in the database when payment is successful
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    console.log('Processing checkout.session.completed:', session.id)

    // Only process paid sessions
    if (session.payment_status !== 'paid') {
      console.log('Session not paid yet:', session.id)
      return
    }

    // Extract metadata
    const locale = session.metadata?.locale || 'en'
    const cartItemsStr = session.metadata?.cart_items || '[]'
    const cartItems = JSON.parse(cartItemsStr)

    // Get session details with line items
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'payment_intent'],
    })

    const lineItems = fullSession.line_items?.data || []

    // Get customer email
    const customerEmail = session.customer_details?.email || session.customer_email

    // Build shipping address JSONB
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

    // Get payment intent ID
    const paymentIntentId =
      typeof fullSession.payment_intent === 'string'
        ? fullSession.payment_intent
        : fullSession.payment_intent?.id

    // Idempotency check: Check if order already exists for this session
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, status, created_at')
      .eq('stripe_session_id', session.id)
      .single()

    if (existingOrder) {
      console.log('Order already exists for session:', session.id, '— skipping (idempotent)')
      console.log('Existing order ID:', existingOrder.id)
      return // Idempotent: order already processed
    }

    // Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        stripe_session_id: session.id,
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
      throw orderError
    }

    console.log('Created order:', order.id)

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

    // Filter out items without product_id (in case of data mismatch)
    const validOrderItems = orderItems.filter((item) => item.product_id)

    if (validOrderItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(validOrderItems)

      if (itemsError) {
        console.error('Failed to create order items:', itemsError)
        // Don't throw - order is already created
      } else {
        console.log(`Created ${validOrderItems.length} order items`)
      }
    }

    // Create notification for the user (if user_id is found)
    // For guest checkouts, we'll create a notification linked to the email
    // Note: In a real system, you'd look up user by email first
    const notificationData = {
      type: 'order_confirmation',
      title: `Order Confirmed - ${order.id}`,
      body: `Your order has been confirmed. Total: ${(order.total_cents / 100).toFixed(2)} ${order.currency.toUpperCase()}`,
      data: {
        order_id: order.id,
        session_id: session.id,
        total_cents: order.total_cents,
        currency: order.currency,
      },
      is_read: false,
    }

    // Try to find user by email to link notification
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', customerEmail)
      .single()

    if (user) {
      // Create notification for authenticated user
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          ...notificationData,
        })

      if (notifError) {
        console.error('Failed to create notification:', notifError)
      } else {
        console.log('Created notification for user:', user.id)
      }
    } else {
      console.log('No user found for email - skipping notification (guest checkout)')
    }

    // Create audit log entry
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        actor_type: 'webhook',
        actor_id: 'stripe_webhook',
        action: 'order_created',
        resource_type: 'order',
        resource_id: order.id,
        changes: {
          status: 'paid',
          total_cents: order.total_cents,
          currency: order.currency,
        },
        metadata: {
          stripe_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
          customer_email: customerEmail,
          locale,
        },
      })

    if (auditError) {
      console.error('Failed to create audit log entry:', auditError)
    } else {
      console.log('Created audit log entry for order:', order.id)
    }

    // Submit order to Printify
    if (validOrderItems.length > 0 && shippingAddress && customerEmail) {
      try {
        console.log('Submitting order to Printify...')

        // Fetch product and variant Printify IDs
        const productIds = validOrderItems.map(item => item.product_id)
        const variantIds = validOrderItems.map(item => item.variant_id).filter(Boolean)

        const { data: products } = await supabase
          .from('products')
          .select('id, printify_id')
          .in('id', productIds)

        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, printify_variant_id')
          .in('id', variantIds)

        // Create lookup maps
        const productMap = new Map(products?.map(p => [p.id, p.printify_id]) || [])
        const variantMap = new Map(variants?.map(v => [v.id, v.printify_variant_id]) || [])

        // Build Printify line items
        const printifyLineItems = validOrderItems
          .filter(item => {
            const printifyProductId = productMap.get(item.product_id)
            const printifyVariantId = item.variant_id ? variantMap.get(item.variant_id) : null
            // Only include items where we have Printify IDs
            return printifyProductId && (printifyVariantId || !item.variant_id)
          })
          .map(item => ({
            product_id: productMap.get(item.product_id)!,
            variant_id: item.variant_id ? parseInt(variantMap.get(item.variant_id)!, 10) : 0,
            quantity: item.quantity,
          }))

        if (printifyLineItems.length === 0) {
          console.log('No valid Printify line items - skipping Printify submission')
        } else {
          // Create Printify order
          const printifyAddress = buildPrintifyAddress(shippingAddress, customerEmail)

          const printifyOrder = await printify.createOrder({
            external_id: order.id, // Link to our order ID
            label: `Order ${order.id.slice(0, 8)}`,
            line_items: printifyLineItems,
            shipping_method: 1, // Standard shipping (most common default)
            send_shipping_notification: true,
            address_to: printifyAddress,
          })

          console.log('Created Printify order:', printifyOrder.id)

          // Update order with Printify order ID
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              printify_order_id: printifyOrder.id,
              status: 'submitted', // Update status to submitted
              printify_last_attempt_at: new Date().toISOString(),
            })
            .eq('id', order.id)

          if (updateError) {
            console.error('Failed to update order with Printify ID:', updateError)
          } else {
            console.log('Updated order with Printify order ID')
          }

          // Submit order for production
          try {
            await printify.submitOrderForProduction(printifyOrder.id)
            console.log('Submitted Printify order for production')
          } catch (productionError) {
            console.error('Failed to submit Printify order for production:', productionError)

            // Mark order for retry
            const errorMessage = productionError instanceof Error
              ? productionError.message
              : 'Failed to submit order for production'

            await supabase
              .from('orders')
              .update({
                printify_error: errorMessage,
                printify_retry_count: 1,
                printify_last_attempt_at: new Date().toISOString(),
              })
              .eq('id', order.id)

            // Notify admin of production failure
            await notifyAdminOfPrintifyFailure(order.id, 'production', errorMessage)
          }
        }
      } catch (printifyError) {
        console.error('Error submitting order to Printify:', printifyError)

        // Mark order for retry with error details
        const errorMessage = printifyError instanceof Error
          ? printifyError.message
          : 'Unknown Printify error'

        await supabase
          .from('orders')
          .update({
            printify_error: errorMessage,
            printify_retry_count: 1,
            printify_last_attempt_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        // Notify admin of the failure
        await notifyAdminOfPrintifyFailure(order.id, 'submission', errorMessage)

        // Don't throw - we don't want to fail the entire webhook
        // The order is still created in our system and marked for retry
      }
    } else {
      console.log('Missing shipping address or items - skipping Printify submission')
    }

    // TODO: Send confirmation email (future feature)

    console.log('Successfully processed checkout session:', session.id)
  } catch (error) {
    console.error('Error handling checkout session:', error)
    // Don't throw - we don't want to cause Stripe to retry indefinitely
  }
}

/**
 * Notify admin of Printify submission failure
 * Creates a notification for all admin users
 */
async function notifyAdminOfPrintifyFailure(
  orderId: string,
  failureType: 'submission' | 'production',
  errorMessage: string
) {
  try {
    // Find all admin users
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')

    if (!admins || admins.length === 0) {
      console.warn('No admin users found - cannot send Printify failure notification')
      return
    }

    // Create notification for each admin
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type: 'printify_error',
      title: `Printify ${failureType} failed`,
      body: `Order ${orderId.slice(0, 8)} failed to submit to Printify: ${errorMessage}`,
      data: {
        order_id: orderId,
        failure_type: failureType,
        error: errorMessage,
      },
      is_read: false,
    }))

    const { error } = await supabase
      .from('notifications')
      .insert(notifications)

    if (error) {
      console.error('Failed to create admin notifications:', error)
    } else {
      console.log(`Created ${notifications.length} admin notifications for Printify failure`)
    }
  } catch (error) {
    console.error('Error notifying admin of Printify failure:', error)
  }
}
