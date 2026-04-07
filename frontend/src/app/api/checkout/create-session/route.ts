/**
 * Stripe Checkout Session Creation API
 *
 * POST /api/checkout/create-session
 * Creates a Stripe Checkout session for payment processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { STORE_DEFAULTS, ALLOWED_SHIPPING_COUNTRIES, BASE_URL } from '@/lib/store-config';
import { validateCoupon } from '@/lib/coupon-validation';

/**
 * POST /api/checkout/create-session
 *
 * Create a Stripe Checkout Session for cart checkout
 *
 * Request body:
 * @param {Array} cartItems - Array of cart items with productId, variantId, quantity, personalization
 * @param {Object} shippingAddress - Shipping address (name, line1, city, state, postal_code, country)
 * @param {string} locale - User locale (en/es/de, default: en)
 * @param {string} currency - Currency code (default: EUR)
 * @param {string} customerEmail - Customer email address
 * @param {string} gift_message - Optional gift message
 *
 * @returns {Object} JSON response with Stripe Checkout Session URL
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit checkout session creation (5 per minute per IP)
    const { checkoutLimiter } = await import('@/lib/rate-limit')
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const { success } = checkoutLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
    }

    const body = await req.json();
    const { cartItems, shippingAddress, locale = 'en', currency = STORE_DEFAULTS.stripeCurrency, customerEmail, gift_message, couponCode } = body;

    // Derive userId from auth header (optional — guests can checkout without auth)
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        authenticatedUserId = authUser?.id || null;
      } catch { /* anonymous checkout */ }
    }

    // Validate required fields
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Cart items are required' },
        { status: 400 }
      );
    }

    // Validate all items have variant_id (required for Printify fulfillment)
    const itemsWithoutVariant = cartItems.filter(
      (item: any) => !item.variant_id
    );
    if (itemsWithoutVariant.length > 0) {
      return NextResponse.json(
        {
          error: 'Incomplete cart items',
          code: 'MISSING_VARIANTS',
          message: 'All items require a variant selection (size/color).',
          items: itemsWithoutVariant.map((i: any) => i.product_id),
        },
        { status: 400 }
      );
    }

    // Validate all products exist and are active
    const productIds = [...new Set(cartItems.map((item: any) => item.product_id).filter(Boolean))];

    // Verify all products are active
    if (productIds.length > 0) {
      const { data: activeProducts } = await supabaseAdmin
        .from('products')
        .select('id')
        .in('id', productIds)
        .eq('status', 'active')
        .is('deleted_at', null);

      const activeProductIds = new Set((activeProducts || []).map((p: any) => p.id));
      const inactiveItems = productIds.filter(id => !activeProductIds.has(id));
      if (inactiveItems.length > 0) {
        return NextResponse.json(
          {
            error: 'Some products are no longer available',
            code: 'PRODUCTS_UNAVAILABLE',
            items: inactiveItems,
          },
          { status: 409 }
        );
      }
    }

    // Stock validation: check variant availability before creating payment session
    if (productIds.length > 0) {
      const { data: variants } = await supabaseAdmin
        .from('product_variants')
        .select('product_id, color, size, is_available, price_cents')
        .in('product_id', productIds)
        .eq('is_enabled', true);

      const unavailableItems: Array<{ productId: string; color?: string; size?: string; name?: string }> = [];

      for (const item of cartItems) {
        if (!item.product_id) continue;
        const itemColor = item.variant_details?.color || item.color;
        const itemSize = item.variant_details?.size || item.size;

        // Find matching variant
        const matchingVariant = variants?.find(v =>
          v.product_id === item.product_id &&
          (!itemColor || v.color === itemColor) &&
          (!itemSize || v.size === itemSize)
        );

        // If no variant found or variant is unavailable
        if (!matchingVariant || !matchingVariant.is_available) {
          unavailableItems.push({
            productId: item.product_id,
            color: itemColor,
            size: itemSize,
            name: item.product_name || item.name,
          });
        }
      }

      if (unavailableItems.length > 0) {
        return NextResponse.json(
          {
            error: 'ITEMS_UNAVAILABLE',
            unavailableItems,
          },
          { status: 409 }
        );
      }
    }

    // --- Coupon validation (shared logic with /api/coupons/validate) ---
    let validatedCoupon: { code: string; discount_type: string; discount_value: number } | null = null;
    if (couponCode && typeof couponCode === 'string') {
      const cartTotalForValidation = cartItems.reduce(
        (sum: number, item: any) => sum + ((item.product_price || 0) * (item.quantity || 1)),
        0
      );
      const couponResult = await validateCoupon({
        code: couponCode,
        cartTotal: cartTotalForValidation,
        userId: authenticatedUserId, // Derived from auth header, never trust client body
      });
      if (couponResult.valid) {
        validatedCoupon = {
          code: couponResult.coupon.code,
          discount_type: couponResult.coupon.discount_type,
          discount_value: Number(couponResult.coupon.discount_value),
        };
      }
    }

    // --- Compositions: resolve production URLs for custom designs ---
    // Instead of creating temp products, we pass production file URLs directly
    // to the Printful order via the `files` parameter on each line item.
    for (const item of cartItems) {
      const compositionId = item.composition_id
      if (!compositionId) continue

      try {
        const { data: comp } = await supabaseAdmin
          .from('design_compositions')
          .select('production_url')
          .eq('id', compositionId)
          .single()

        if (comp?.production_url) {
          // Parse production_url: direct URL for single panel, JSON for multi-panel
          if (comp.production_url.startsWith('{')) {
            item._production_urls = JSON.parse(comp.production_url)
          } else {
            item._production_urls = { default: comp.production_url }
          }
        }
      } catch (compError) {
        console.error(`Failed to resolve production URLs for composition ${compositionId}:`, compError)
      }
    }

    // Server-side price authority: override client prices with DB variant prices
    if (productIds.length > 0) {
      const { data: pricingVariants } = await supabaseAdmin
        .from('product_variants')
        .select('product_id, color, size, price_cents')
        .in('product_id', productIds)
        .eq('is_enabled', true)
        .eq('is_available', true)

      if (pricingVariants) {
        for (const item of cartItems) {
          if (!item.product_id) continue
          const itemColor = item.variant_details?.color || item.color
          const itemSize = item.variant_details?.size || item.size
          const match = pricingVariants.find((v: any) =>
            v.product_id === item.product_id &&
            (!itemColor || v.color === itemColor) &&
            (!itemSize || v.size === itemSize)
          )
          if (match?.price_cents) {
            item.product_price = match.price_cents / 100
          }
        }
      }
    }

    // Create line items for Stripe Checkout
    const lineItems = cartItems.map((item: any) => {
      const productData: any = {
        name: item.product_name || item.name || 'Product',
      };

      if (item.variant_name) {
        productData.description = item.variant_name;
      }

      if (item.product_image && !item.product_image.includes('placeholder')) {
        productData.images = [item.product_image];
      }

      const totalUnitPrice = item.product_price || 0;

      return {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: productData,
          unit_amount: Math.round(totalUnitPrice * 100), // Convert to cents
        },
        quantity: item.quantity || 1,
      };
    });

    // Apply coupon discount as a negative line item
    if (validatedCoupon) {
      const totalAmountCents = lineItems.reduce(
        (sum: number, item: any) => sum + item.price_data.unit_amount * item.quantity,
        0
      );
      let discountCents = 0;
      if (validatedCoupon.discount_type === 'percentage') {
        discountCents = Math.round(totalAmountCents * (validatedCoupon.discount_value / 100));
      } else {
        // fixed amount — discount_value is in the same currency unit (e.g., euros)
        discountCents = Math.round(validatedCoupon.discount_value * 100);
      }
      // Cap discount at the cart total
      discountCents = Math.min(discountCents, totalAmountCents);

      if (discountCents > 0) {
        // Use Stripe coupons via the discounts parameter
        // First create a one-time Stripe coupon
        const stripeCoupon = await stripe.coupons.create({
          amount_off: discountCents,
          currency: currency.toLowerCase(),
          duration: 'once',
          name: `Coupon: ${validatedCoupon.code}`,
        });
        // We'll attach it to the session config later
        (lineItems as any)._stripeCouponId = stripeCoupon.id;
      }
    }

    // Build success and cancel URLs
    const baseUrl = BASE_URL;
    const successUrl = `${baseUrl}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/${locale}/checkout/cancel`;

    // Build payment method types (conditionally include crypto)
    const paymentMethodTypes: string[] = ['card'];
    if (process.env.STRIPE_CRYPTO_ENABLED === 'true') {
      paymentMethodTypes.push('crypto');
    }

    // --- Stripe Connect: per-tenant connected account + application fee ---
    // Platform application_fee_amount by plan tier (basis points → percent)
    const PLAN_FEE_RATES: Record<string, number> = {
      free: 0.10,       // 10% platform fee
      starter: 0.05,    // 5%
      pro: 0.03,        // 3%
      enterprise: 0.02, // 2%
    }

    let stripeConnectAccountId: string | null = null
    let applicationFeeAmount: number | null = null

    const tenantId = req.headers.get('x-tenant-id')
    if (tenantId) {
      try {
        // Look up tenant's Stripe connected account ID and plan
        const [{ data: connectConfig }, { data: tenantRow }] = await Promise.all([
          supabaseAdmin
            .from('tenant_configs')
            .select('value')
            .eq('tenant_id', tenantId)
            .eq('key', 'stripe:connected_account_id')
            .single(),
          supabaseAdmin
            .from('tenants')
            .select('plan')
            .eq('id', tenantId)
            .single(),
        ])

        if (connectConfig?.value) {
          const connectedId = typeof connectConfig.value === 'string'
            ? connectConfig.value
            : (connectConfig.value as { v?: string })?.v
          if (connectedId) {
            stripeConnectAccountId = connectedId
            // Calculate application fee from total order amount
            const totalAmountCents = lineItems.reduce(
              (sum: number, item: any) =>
                sum + item.price_data.unit_amount * item.quantity,
              0
            )
            const feeRate = PLAN_FEE_RATES[tenantRow?.plan ?? 'free'] ?? 0.10
            applicationFeeAmount = Math.round(totalAmountCents * feeRate)
          }
        }
      } catch {
        // Connect lookup failed — proceed without Connect routing
      }
    }
    // --- End Stripe Connect ---

    // Calculate cart subtotal in euros for shipping threshold check
    const cartSubtotalCents = lineItems.reduce(
      (sum: number, item: any) => sum + item.price_data.unit_amount * item.quantity,
      0
    );
    const cartSubtotalEuros = cartSubtotalCents / 100;
    const isFreeShipping = cartSubtotalEuros >= STORE_DEFAULTS.freeShippingThreshold;

    // Create Stripe Checkout session
    const sessionConfig: any = {
      mode: 'payment',
      payment_method_types: paymentMethodTypes,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: locale === 'es' ? 'es' : locale === 'de' ? 'de' : 'en',
      currency: currency.toLowerCase(),
      // Per-tenant Stripe Connect routing (only when a connected account is configured)
      ...(stripeConnectAccountId && {
        payment_intent_data: {
          transfer_data: { destination: stripeConnectAccountId },
          ...(applicationFeeAmount !== null && { application_fee_amount: applicationFeeAmount }),
        },
      }),
      // Automatic tax calculation (EU VAT compliance)
      automatic_tax: {
        enabled: true,
      },
      // Shipping address collection (let Stripe collect it if not pre-filled)
      shipping_address_collection: shippingAddress
        ? undefined
        : {
            allowed_countries: ALLOWED_SHIPPING_COUNTRIES as unknown as string[],
          },
      // Shipping: free for orders >= €50, otherwise €4.99 (EU standard)
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount' as const,
            fixed_amount: {
              amount: isFreeShipping ? 0 : 499, // €0 or €4.99
              currency: currency.toLowerCase(),
            },
            display_name: isFreeShipping
              ? (locale === 'de' ? 'Kostenloser Versand' : locale === 'es' ? 'Envío Gratis' : 'Free Shipping')
              : (locale === 'de' ? 'Standardversand (4,99 €)' : locale === 'es' ? 'Envío Estándar (4,99 €)' : 'Standard Shipping (€4.99)'),
            delivery_estimate: {
              minimum: {
                unit: 'business_day' as const,
                value: 5,
              },
              maximum: {
                unit: 'business_day' as const,
                value: 7,
              },
            },
          },
        },
      ],
      metadata: {
        locale,
        cart_items: JSON.stringify(cartItems.map((item: any) => ({
          pid: item.product_id,
          vid: item.variant_id,
          qty: item.quantity,
          ...(item.personalization_id ? { per: item.personalization_id } : {}),
          ...(item.composition_id ? { comp: item.composition_id } : {}),
        }))),
        ...(gift_message && typeof gift_message === 'string' && {
          gift_message: gift_message.slice(0, 200).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
        }),
      },
    };

    // Link Stripe customer for authenticated users (enables saved cards)
    if (authenticatedUserId) {
      const { data: userProfile } = await supabaseAdmin
        .from('users')
        .select('stripe_customer_id, email')
        .eq('id', authenticatedUserId)
        .single()

      let stripeCustomerId = userProfile?.stripe_customer_id

      if (!stripeCustomerId && userProfile?.email) {
        // Create Stripe customer on first checkout
        const customer = await stripe.customers.create({
          email: userProfile.email,
          metadata: { user_id: authenticatedUserId },
        })
        stripeCustomerId = customer.id

        await supabaseAdmin
          .from('users')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', authenticatedUserId)
      }

      if (stripeCustomerId) {
        sessionConfig.customer = stripeCustomerId
        // Allow saving card for future purchases
        sessionConfig.payment_intent_data = {
          ...sessionConfig.payment_intent_data,
          setup_future_usage: 'on_session',
        }
      }
    } else if (customerEmail && typeof customerEmail === 'string') {
      // Guest checkout — use email only
      sessionConfig.customer_email = customerEmail;
    }

    // Apply coupon discount to session
    const stripeCouponId = (lineItems as any)._stripeCouponId;
    if (stripeCouponId) {
      sessionConfig.discounts = [{ coupon: stripeCouponId }];
      // Store coupon code in metadata for order tracking
      sessionConfig.metadata.coupon_code = validatedCoupon!.code;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Stripe session creation error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
