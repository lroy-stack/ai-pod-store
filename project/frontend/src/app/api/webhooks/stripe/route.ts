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
import { sendOrderConfirmationEmail } from '@/lib/resend'
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

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break

    case 'payment_intent.succeeded':
      console.log('PaymentIntent succeeded:', event.data.object.id)
      break

    case 'payment_intent.payment_failed':
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
    const shipping = session.collected_information?.shipping_details
    const shippingAddress = shipping?.address
      ? {
          name: shipping.name,
          line1: shipping.address.line1,
          line2: shipping.address.line2,
          city: shipping.address.city,
          state: shipping.address.state,
          postal_code: shipping.address.postal_code,
          country: shipping.address.country,
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
        currency: session.currency || 'eur',
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
    const orderDisplayId = order.id.slice(0, 8) // Use first 8 chars of UUID as display ID
    const itemCount = validOrderItems.length
    const totalAmount = (order.total_cents / 100).toFixed(2)
    const currencyCode = order.currency.toUpperCase()

    const notificationData = {
      type: 'order_confirmation',
      title: `Order #${orderDisplayId} Confirmed`,
      body: `Your order has been confirmed. ${itemCount} ${itemCount === 1 ? 'item' : 'items'} • Total: ${totalAmount} ${currencyCode}`,
      data: {
        order_id: order.id,
        session_id: session.id,
        total_cents: order.total_cents,
        currency: order.currency,
        item_count: itemCount,
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

    // Handle credit pack purchases
    if (session.metadata?.type === 'credit_pack' && session.metadata?.user_id) {
      await handleCreditPackPurchase(session)
    }

    // Send order confirmation email
    if (customerEmail) {
      try {
        const orderNumber = order.id.slice(0, 8)
        await sendOrderConfirmationEmail({
          to: customerEmail,
          orderId: order.id,
          orderNumber,
          itemCount: validOrderItems.length,
          totalCents: order.total_cents,
          currency: order.currency,
          locale: order.locale || 'en',
        })
        console.log('Order confirmation email sent to:', customerEmail)
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError)
        // Don't throw - email failure shouldn't fail the webhook
      }
    }

    console.log('Successfully processed checkout session:', session.id)
  } catch (error) {
    console.error('Error handling checkout session:', error)
    // Don't throw - we don't want to cause Stripe to retry indefinitely
  }
}

/**
 * Handle subscription created/updated
 * Updates user tier and subscription info
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  try {
    // Find user by Stripe customer ID
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, credit_balance')
      .eq('stripe_customer_id', customerId)
      .single()

    if (userError || !user) {
      console.error('Subscription update: user not found for customer', customerId)
      return
    }

    const isActive = subscription.status === 'active'
    const periodEnd = (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000).toISOString()
      : null

    // Update user tier and subscription info
    const { error: updateError } = await supabase
      .from('users')
      .update({
        tier: isActive ? 'premium' : 'free',
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status === 'active' ? 'active'
          : subscription.status === 'past_due' ? 'past_due'
          : 'none',
        subscription_period_end: periodEnd,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update user subscription:', updateError)
      return
    }

    // Add monthly bonus credits on new subscription activation
    if (isActive) {
      const bonusCredits = 10
      const newBalance = (user.credit_balance || 0) + bonusCredits

      await supabase
        .from('users')
        .update({ credit_balance: newBalance })
        .eq('id', user.id)

      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: bonusCredits,
        reason: 'subscription_bonus',
        balance_after: newBalance,
      })

      console.log(`Added ${bonusCredits} bonus credits for user ${user.id}`)
    }

    console.log(`Updated subscription for user ${user.id}: tier=${isActive ? 'premium' : 'free'}`)
  } catch (error) {
    console.error('Error handling subscription update:', error)
  }
}

/**
 * Handle subscription deleted/cancelled
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

    const { error } = await supabase
      .from('users')
      .update({
        tier: 'free',
        subscription_status: 'cancelled',
      })
      .eq('stripe_customer_id', customerId)

    if (error) {
      console.error('Failed to handle subscription deletion:', error)
    } else {
      console.log('Subscription cancelled for customer:', customerId)
    }
  } catch (error) {
    console.error('Error handling subscription deletion:', error)
  }
}

/**
 * Handle credit pack purchase from checkout.session.completed
 */
async function handleCreditPackPurchase(session: Stripe.Checkout.Session) {
  try {
    const userId = session.metadata?.user_id
    const credits = parseInt(session.metadata?.credits || '0')

    if (!userId || !credits) return

    // Fetch current balance
    const { data: user } = await supabase
      .from('users')
      .select('credit_balance')
      .eq('id', userId)
      .single()

    const currentBalance = user?.credit_balance || 0
    const newBalance = currentBalance + credits

    // Update balance
    await supabase
      .from('users')
      .update({ credit_balance: newBalance })
      .eq('id', userId)

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: credits,
      reason: 'purchase',
      stripe_payment_id: session.payment_intent as string || session.id,
      balance_after: newBalance,
    })

    console.log(`Added ${credits} credits for user ${userId} (new balance: ${newBalance})`)
  } catch (error) {
    console.error('Error handling credit pack purchase:', error)
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
