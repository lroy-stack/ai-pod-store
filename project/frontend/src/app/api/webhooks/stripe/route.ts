/**
 * Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events (checkout.session.completed, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { getProvider, initializeProviders } from '@/lib/pod'
import { canonicalAddressFromStripe } from '@/lib/pod/printify/mapper'
import { sendOrderConfirmationEmail, sendCreditPurchaseEmail } from '@/lib/resend'
import { createClient } from '@supabase/supabase-js'
import { triggerDripSequence } from '@/lib/email-drip'
import { BASE_URL } from '@/lib/store-config'
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

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
      break

    case 'charge.dispute.created':
      await handleChargeDisputeCreated(event.data.object as Stripe.Dispute)
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
    const giftMessage = session.metadata?.gift_message || null

    // Get session details with line items and payment method
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'payment_intent', 'payment_intent.payment_method'],
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

    // Get payment intent ID and payment method
    const paymentIntentId =
      typeof fullSession.payment_intent === 'string'
        ? fullSession.payment_intent
        : fullSession.payment_intent?.id

    // Get payment method type (card, crypto, etc.)
    let paymentMethodType: string | null = null
    if (typeof fullSession.payment_intent !== 'string' && fullSession.payment_intent?.payment_method) {
      const paymentMethod = fullSession.payment_intent.payment_method
      if (typeof paymentMethod !== 'string') {
        paymentMethodType = paymentMethod.type || null
      }
    }

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

    // Look up user by email (for authenticated users)
    let userId: string | null = null
    if (customerEmail) {
      const { data: userByEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', customerEmail)
        .single()
      userId = userByEmail?.id || null
    }

    // Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        status: 'paid',
        total_cents: session.amount_total || 0,
        currency: session.currency || 'eur',
        shipping_address: shippingAddress,
        customer_email: customerEmail,
        locale,
        gift_message: giftMessage,
        payment_method: paymentMethodType,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (orderError) {
      console.error('Failed to create order:', orderError)
      throw orderError
    }

    console.log('Created order:', order.id)

    // Create order items (variant_id is required — NOT NULL constraint)
    const orderItems = lineItems.map((item, index) => {
      const cartItem = cartItems[index] || {}
      return {
        order_id: order.id,
        product_id: cartItem.product_id || null,
        variant_id: cartItem.variant_id,
        personalization_id: cartItem.personalization_id || null,
        composition_id: cartItem.composition_id || null,
        quantity: item.quantity || 1,
        unit_price_cents: Math.round((item.amount_total || 0) / (item.quantity || 1)),
      }
    })

    // Filter out items without product_id or variant_id (data integrity check)
    const validOrderItems = orderItems.filter((item) => item.product_id && item.variant_id)

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

    // Create notification for authenticated user (reuse userId from earlier lookup)
    if (userId) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          ...notificationData,
        })

      if (notifError) {
        console.error('Failed to create notification:', notifError)
      } else {
        console.log('Created notification for user:', userId)
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

    // Increment coupon usage counter if a coupon was applied
    const couponCode = session.metadata?.coupon_code
    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id, times_used')
        .eq('code', couponCode)
        .single()

      if (coupon) {
        const { error: couponError } = await supabase
          .from('coupons')
          .update({ times_used: (coupon.times_used || 0) + 1 })
          .eq('id', coupon.id)

        if (couponError) {
          console.error('Failed to increment coupon usage:', couponError)
        } else {
          console.log(`Incremented coupon "${couponCode}" usage to ${(coupon.times_used || 0) + 1}`)
        }
      }
    }

    // Submit order to POD provider
    if (validOrderItems.length > 0 && shippingAddress && customerEmail) {
      try {
        initializeProviders()
        const provider = getProvider()
        console.log('Submitting order to POD provider...')

        // Fetch product and variant provider IDs
        const productIds = validOrderItems.map(item => item.product_id)
        const variantIds = validOrderItems.map(item => item.variant_id).filter(Boolean)

        const { data: products } = await supabase
          .from('products')
          .select('id, provider_product_id')
          .in('id', productIds)

        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, external_variant_id')
          .in('id', variantIds)

        // Create lookup maps
        const productMap = new Map(products?.map(p => [p.id, p.provider_product_id]) || [])
        const variantMap = new Map(variants?.map(v => [v.id, v.external_variant_id]) || [])

        // Guard: verify all items have valid provider variant mappings
        const itemsMissingProviderVariant = validOrderItems.filter(item => {
          const pvId = variantMap.get(item.variant_id)
          return !pvId || pvId === '0'
        })

        if (itemsMissingProviderVariant.length > 0) {
          console.error('Order items missing provider variant mapping:', itemsMissingProviderVariant)
          await supabase.from('orders').update({
            pod_error: 'Items missing provider variant mapping',
            status: 'requires_review',
          }).eq('id', order.id)

          await notifyAdminOfProviderFailure(order.id, 'variant_mapping', 'One or more items have no provider variant mapping')
          if (customerEmail) {
            await sendOrderIssueEmail(customerEmail, order.id, order.locale || 'en')
          }
          return
        }

        // Build production URLs map from cart metadata (keyed by composition_id)
        const productionUrlsMap = new Map<string, Record<string, string>>()
        for (const ci of cartItems) {
          if (ci.composition_id && ci.production_urls) {
            productionUrlsMap.set(ci.composition_id, ci.production_urls)
          }
        }

        // Build provider line items (variant_id is guaranteed non-null)
        const providerLineItems = validOrderItems
          .filter(item => {
            const providerProductId = productMap.get(item.product_id)
            const providerVariantId = variantMap.get(item.variant_id)
            return providerProductId && providerVariantId
          })
          .map(item => {
            const base = {
              product_id: productMap.get(item.product_id)!,
              variant_id: parseInt(variantMap.get(item.variant_id)!, 10),
              quantity: item.quantity,
            }
            // If custom design, include production file URLs
            const prodUrls = item.composition_id ? productionUrlsMap.get(item.composition_id) : null
            if (prodUrls) {
              return {
                ...base,
                files: Object.entries(prodUrls).map(([placement, url]) => ({
                  type: placement,
                  url: url as string,
                })),
              }
            }
            return base
          })

        if (providerLineItems.length === 0) {
          console.log('No valid provider line items - skipping POD submission')
        } else {
          // Create POD provider order
          const canonicalAddress = canonicalAddressFromStripe(shippingAddress, customerEmail)

          const printifyOrder = await provider.createOrder({
            internalOrderId: order.id,
            label: `Order ${order.id.slice(0, 8)}`,
            lineItems: providerLineItems.map((li) => ({
              productExternalId: li.product_id,
              variantExternalId: String(li.variant_id),
              quantity: li.quantity,
              ...('files' in li && li.files ? { files: li.files } : {}),
            })),
            shippingAddress: canonicalAddress,
            suppressShippingNotification: false,
          })

          console.log('Created POD provider order:', printifyOrder.externalId)

          // Update order with provider order ID
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              external_order_id: printifyOrder.externalId,
              pod_provider: 'printful',
              status: 'submitted', // Update status to submitted
              pod_last_attempt_at: new Date().toISOString(),
            })
            .eq('id', order.id)

          if (updateError) {
            console.error('Failed to update order with provider order ID:', updateError)
          } else {
            console.log('Updated order with provider order ID')
          }

          // Submit order for production
          try {
            await provider.submitForProduction(printifyOrder.externalId)
            console.log('Submitted POD order for production')
          } catch (productionError) {
            console.error('Failed to submit POD order for production:', productionError)

            // Mark order for retry
            const errorMessage = productionError instanceof Error
              ? productionError.message
              : 'Failed to submit order for production'

            await supabase
              .from('orders')
              .update({
                pod_error: errorMessage,
                pod_retry_count: 1,
                pod_last_attempt_at: new Date().toISOString(),
              })
              .eq('id', order.id)

            // Notify admin and customer of production failure
            await notifyAdminOfProviderFailure(order.id, 'production', errorMessage)
            if (customerEmail) {
              await sendOrderIssueEmail(customerEmail, order.id, order.locale || 'en')
            }
          }
        }
      } catch (printifyError) {
        console.error('Error submitting order to POD provider:', printifyError)

        // Mark order for retry with error details
        const errorMessage = printifyError instanceof Error
          ? printifyError.message
          : 'Unknown POD provider error'

        await supabase
          .from('orders')
          .update({
            pod_error: errorMessage,
            pod_retry_count: 1,
            pod_last_attempt_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        // Notify admin and customer of the failure
        await notifyAdminOfProviderFailure(order.id, 'submission', errorMessage)
        if (customerEmail) {
          await sendOrderIssueEmail(customerEmail, order.id, order.locale || 'en')
        }

        // Don't throw - we don't want to fail the entire webhook
        // The order is still created in our system and marked for retry
      }
    } else {
      console.log('Missing shipping address or items - skipping POD submission')
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

    // Add monthly bonus credits on new subscription activation (atomic)
    if (isActive) {
      const bonusCredits = 10

      const { data: bonusResult } = await supabase.rpc('add_credits', {
        p_user_id: user.id,
        p_amount: bonusCredits,
      })

      const newBalance = bonusResult?.balance ?? 0

      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: bonusCredits,
        reason: 'subscription_bonus',
        balance_after: newBalance,
      })

      console.log(`Added ${bonusCredits} bonus credits for user ${user.id}`)
    }

    // Trigger welcome drip sequence for new subscribers
    if (isActive) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('email')
        .eq('id', user.id)
        .single()

      if (userProfile?.email) {
        triggerDripSequence(user.id, userProfile.email, 'welcome').catch((err) =>
          console.error('Failed to trigger drip sequence:', err)
        )
      }
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
 * Idempotent: uses UNIQUE(user_id, stripe_payment_id) to prevent double-crediting on webhook retries.
 * Atomic: uses credit_balance = credit_balance + N (no SELECT-then-UPDATE).
 */
async function handleCreditPackPurchase(session: Stripe.Checkout.Session) {
  try {
    const userId = session.metadata?.user_id
    const credits = parseInt(session.metadata?.credits || '0')
    const paymentId = (session.payment_intent as string) || session.id

    if (!userId || !credits || !paymentId) return

    // Idempotency: insert transaction first — UNIQUE(user_id, stripe_payment_id) rejects duplicates
    // balance_after is set to 0 temporarily, updated after atomic increment
    const { error: txError } = await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: credits,
      reason: 'purchase',
      stripe_payment_id: paymentId,
      balance_after: 0,
    })

    if (txError) {
      // UNIQUE violation = already processed (idempotent)
      if (txError.code === '23505') {
        console.log(`Credit pack already processed for payment ${paymentId} — skipping (idempotent)`)
        return
      }
      throw txError
    }

    // Atomic balance update via RPC: credit_balance = credit_balance + N (no race condition)
    const { data: rpcResult } = await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_amount: credits,
    })

    const newBalance = rpcResult?.balance ?? 0

    // Backfill the correct balance_after in the transaction record
    await supabase
      .from('credit_transactions')
      .update({ balance_after: newBalance })
      .eq('user_id', userId)
      .eq('stripe_payment_id', paymentId)

    console.log(`Added ${credits} credits for user ${userId} (new balance: ${newBalance})`)

    // Fetch user for email
    const { data: user } = await supabase
      .from('users')
      .select('email, locale')
      .eq('id', userId)
      .single()

    // Send confirmation email
    if (user?.email) {
      try {
        await sendCreditPurchaseEmail({
          to: user.email,
          credits,
          priceCents: session.amount_total || 0,
          currency: session.currency || 'eur',
          newBalance,
          locale: user.locale || 'en',
        })
        console.log(`Credit purchase email sent to: ${user.email}`)
      } catch (emailError) {
        console.error('Failed to send credit purchase email:', emailError)
      }
    }
  } catch (error) {
    console.error('Error handling credit pack purchase:', error)
  }
}

/**
 * Handle invoice.payment_failed event
 * Updates subscription status and notifies user + admin
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id

    if (!customerId) return

    // Find user
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('stripe_customer_id', customerId)
      .single()

    if (!user) {
      console.warn('Invoice payment failed: no user found for customer', customerId)
      return
    }

    // Update subscription status to past_due
    await supabase
      .from('users')
      .update({ subscription_status: 'past_due' })
      .eq('id', user.id)

    // Send payment failure email via Resend
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && user.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'SKAPARA <noreply@skapara.com>',
          to: user.email,
          subject: 'Payment Failed — Please Update Your Payment Method',
          html: `
            <h1>Payment Failed</h1>
            <p>We were unable to process your subscription payment.</p>
            <p>Please update your payment method to keep your Premium features active.</p>
            <p><a href="${BASE_URL}/profile">Update Payment Method →</a></p>
          `,
        }),
      }).catch((err) => console.error('Failed to send payment failure email:', err))
    }

    // Alert admin
    fetch(`${BASE_URL}/api/admin/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'invoice_payment_failed',
        message: `Payment failed for user ${user.email || user.id}`,
        severity: 'medium',
      }),
    }).catch(() => {})

    console.log(`Invoice payment failed for user ${user.id}, status set to past_due`)
  } catch (error) {
    console.error('Error handling invoice payment failed:', error)
  }
}

/**
 * Notify admin of POD provider submission failure
 * Creates a notification for all admin users
 */
/**
 * Notify the customer that their order requires manual review.
 * Uses Resend email service.
 */
async function sendOrderIssueEmail(email: string, orderId: string, locale: string) {
  try {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return

    const orderNumber = orderId.slice(0, 8)

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'SKAPARA <noreply@skapara.com>',
        to: email,
        subject: locale === 'es'
          ? `Pedido #${orderNumber} — Revisión necesaria`
          : locale === 'de'
            ? `Bestellung #${orderNumber} — Überprüfung erforderlich`
            : `Order #${orderNumber} — Review Required`,
        html: locale === 'es'
          ? `<h1>Tu pedido requiere revisión</h1><p>Estamos revisando tu pedido #${orderNumber}. Nuestro equipo te contactará pronto con una actualización.</p><p><a href="${BASE_URL}/es/orders">Ver tus pedidos →</a></p>`
          : locale === 'de'
            ? `<h1>Deine Bestellung wird überprüft</h1><p>Wir überprüfen deine Bestellung #${orderNumber}. Unser Team wird sich bald mit einem Update bei dir melden.</p><p><a href="${BASE_URL}/de/orders">Bestellungen ansehen →</a></p>`
            : `<h1>Your order is under review</h1><p>We're reviewing your order #${orderNumber}. Our team will contact you shortly with an update.</p><p><a href="${BASE_URL}/en/orders">View your orders →</a></p>`,
      }),
    })
    console.log(`Order issue email sent to ${email} for order ${orderNumber}`)
  } catch (err) {
    console.error('Failed to send order issue email:', err)
  }
}

async function notifyAdminOfProviderFailure(
  orderId: string,
  failureType: 'submission' | 'production' | 'variant_mapping',
  errorMessage: string
) {
  try {
    // Find all admin users
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')

    if (!admins || admins.length === 0) {
      console.warn('No admin users found - cannot send provider failure notification')
      return
    }

    // Create notification for each admin
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type: 'pod_error',
      title: `Provider ${failureType} failed`,
      body: `Order ${orderId.slice(0, 8)} failed to submit to provider: ${errorMessage}`,
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
      console.log(`Created ${notifications.length} admin notifications for provider failure`)
    }
  } catch (error) {
    console.error('Error notifying admin of provider failure:', error)
  }
}

/**
 * Handle charge.dispute.created event
 * Marks order as disputed, alerts admin, and pauses fulfillment
 */
async function handleChargeDisputeCreated(dispute: Stripe.Dispute) {
  try {
    console.log('Processing charge.dispute.created:', dispute.id)

    // Get the payment intent ID from the dispute
    const paymentIntentId = typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id

    if (!paymentIntentId) {
      console.warn('No payment intent ID found in dispute:', dispute.id)
      return
    }

    // Find the order by payment intent ID
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_email, total_cents, currency, status')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()

    if (orderError || !order) {
      console.warn('Dispute: order not found for payment intent:', paymentIntentId)
      return
    }

    // Update order status to 'cancelled' to pause fulfillment
    // TODO: Add 'disputed' status to orders table CHECK constraint and add columns:
    // stripe_dispute_id, stripe_dispute_reason, stripe_dispute_amount
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled', // Using existing status until migration adds 'disputed'
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('Failed to update order status on dispute:', updateError)
      return
    }

    console.log(`Order ${order.id} cancelled due to chargeback (dispute ${dispute.id}), fulfillment paused`)

    // Create audit log entry
    await supabase
      .from('audit_log')
      .insert({
        actor_type: 'webhook',
        actor_id: 'stripe_webhook',
        action: 'order_disputed',
        resource_type: 'order',
        resource_id: order.id,
        changes: {
          status: 'disputed',
          dispute_id: dispute.id,
          dispute_reason: dispute.reason,
        },
        metadata: {
          payment_intent_id: paymentIntentId,
          dispute_amount: dispute.amount,
          dispute_currency: dispute.currency,
        },
      })

    // Send admin alert notification
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'chargeback',
        title: 'Chargeback Alert',
        body: `Order ${order.id.slice(0, 8)} has a chargeback (${dispute.reason}). Amount: ${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}. Fulfillment paused.`,
        data: {
          order_id: order.id,
          dispute_id: dispute.id,
          dispute_reason: dispute.reason,
          dispute_amount: dispute.amount,
          payment_intent_id: paymentIntentId,
        },
        is_read: false,
      }))

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications)

      if (notifError) {
        console.error('Failed to create admin chargeback notifications:', notifError)
      } else {
        console.log(`Created ${notifications.length} admin chargeback alerts for order ${order.id}`)
      }
    }

    // Alert admin via API endpoint (fallback)
    fetch(`${BASE_URL}/api/admin/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'chargeback',
        message: `Chargeback on order ${order.id.slice(0, 8)}: ${dispute.reason}`,
        severity: 'high',
        metadata: {
          order_id: order.id,
          dispute_id: dispute.id,
          amount: dispute.amount,
        },
      }),
    }).catch(() => {})

    console.log(`Successfully processed chargeback for order ${order.id}`)
  } catch (error) {
    console.error('Error handling charge dispute created:', error)
    // Don't throw - we don't want to cause Stripe to retry indefinitely
  }
}
