/**
 * Handler for checkout.session.completed Stripe webhook event
 *
 * Creates an order in the database when payment is successful,
 * submits to POD provider, and sends confirmation email.
 */

import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { getProvider, initializeProviders } from '@/lib/pod'
import { canonicalAddressFromStripe } from '@/lib/pod/printify/mapper'
import { sendOrderConfirmationEmail, sendCreditPurchaseEmail } from '@/lib/resend'
import { supabase, sendOrderIssueEmail, notifyAdminOfProviderFailure } from './shared'

/**
 * Handle checkout.session.completed event
 * Creates an order in the database when payment is successful
 */
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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
    let cartItems: Array<{ product_id: string; variant_id: string; quantity: number; personalization_id: string | null; composition_id: string | null; [key: string]: unknown }>
    try {
      cartItems = JSON.parse(cartItemsStr).map((ci: any) => ({
        product_id: ci.pid || ci.product_id,
        variant_id: ci.vid || ci.variant_id,
        quantity: ci.qty || ci.quantity,
        personalization_id: ci.per || ci.personalization_id || null,
        composition_id: ci.comp || ci.composition_id || null,
      }))
    } catch {
      console.error('[checkout-completed] Failed to parse cart_items metadata:', cartItemsStr)
      cartItems = []
    }
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

    // Create order record (includes coupon tracking if applied)
    const couponCode = session.metadata?.coupon_code || null
    const discountCents = session.total_details?.amount_discount || 0
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
        ...(couponCode && { coupon_code: couponCode, discount_cents: discountCents }),
      })
      .select()
      .single()

    if (orderError) {
      console.error('Failed to create order:', orderError)
      throw orderError
    }

    console.log('Created order:', order.id)

    // Auto-save shipping address to user profile (if authenticated and new)
    if (userId && shippingAddress && shippingAddress.line1) {
      try {
        const { count } = await supabase
          .from('shipping_addresses')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)

        // Only auto-save if user has fewer than 5 addresses
        if ((count ?? 0) < 5) {
          // Check if this exact address already exists
          const { data: existing } = await supabase
            .from('shipping_addresses')
            .select('id')
            .eq('user_id', userId)
            .eq('street_line1', shippingAddress.line1)
            .eq('postal_code', shippingAddress.postal_code || '')
            .maybeSingle()

          if (!existing) {
            await supabase.from('shipping_addresses').insert({
              user_id: userId,
              full_name: shippingAddress.name || '',
              street_line1: shippingAddress.line1,
              street_line2: shippingAddress.line2 || null,
              city: shippingAddress.city || '',
              state: shippingAddress.state || null,
              postal_code: shippingAddress.postal_code || '',
              country_code: (shippingAddress.country || '').toUpperCase(),
              is_default: (count ?? 0) === 0, // First address = default
            })
            console.log('Auto-saved shipping address from checkout')
          }
        }
      } catch (addrErr) {
        // Non-fatal — order is already created
        console.error('Failed to auto-save address:', addrErr)
      }
    }

    // Create order items — match by product_id from metadata, not array index
    const orderItems = lineItems.map((item) => {
      // Each Stripe line item has metadata with product_id from cart
      const stripeProductId = (item as any).price?.product_metadata?.product_id
        || (item as any).price?.metadata?.product_id
      const emptyCartItem = { product_id: null, variant_id: null, personalization_id: null, composition_id: null, quantity: 1 } as const
      const cartItem = stripeProductId
        ? cartItems.find((ci) => ci.product_id === stripeProductId) || emptyCartItem
        : cartItems.shift() || emptyCartItem // Fallback to sequential if no metadata match
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

    // Increment coupon usage counter if a coupon was applied (idempotent via RPC)
    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', couponCode)
        .single()

      if (coupon) {
        const { data: incremented } = await supabase.rpc('increment_coupon_usage', {
          p_coupon_id: coupon.id,
          p_order_id: order.id,
          p_user_id: userId || null,
          p_discount_cents: discountCents,
        })

        if (incremented === true) {
          console.log(`Incremented coupon "${couponCode}" usage for order ${order.id}`)
        } else {
          console.log(`Coupon "${couponCode}" already counted for order ${order.id} — skipped`)
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

        // Resolve production URLs from design_compositions (no longer in metadata)
        const productionUrlsMap = new Map<string, Record<string, string>>()
        const compositionIds = cartItems
          .map((ci: any) => ci.composition_id)
          .filter(Boolean)

        if (compositionIds.length > 0) {
          const { data: compositions } = await supabase
            .from('design_compositions')
            .select('id, production_url')
            .in('id', compositionIds)

          for (const comp of compositions || []) {
            if (comp.production_url) {
              const urls = comp.production_url.startsWith('{')
                ? JSON.parse(comp.production_url)
                : { default: comp.production_url }
              productionUrlsMap.set(comp.id, urls)
            }
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
