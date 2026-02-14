/**
 * Stripe Checkout Session Creation API
 *
 * POST /api/checkout/create-session
 * Creates a Stripe Checkout session for payment processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cartItems, shippingAddress, locale = 'en', currency = 'usd' } = body;

    // Validate required fields
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Cart items are required' },
        { status: 400 }
      );
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

      return {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: productData,
          unit_amount: Math.round((item.product_price || 0) * 100), // Convert to cents
        },
        quantity: item.quantity || 1,
      };
    });

    // Build success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const successUrl = `${baseUrl}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/${locale}/checkout/cancel`;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: locale === 'es' ? 'es' : locale === 'de' ? 'de' : 'en',
      currency: currency.toLowerCase(),
      // Automatic tax calculation (if Stripe Tax is enabled)
      automatic_tax: {
        enabled: false, // Disabled for now, will enable when Stripe Tax is activated
      },
      // Shipping address collection
      shipping_address_collection: shippingAddress
        ? undefined
        : {
            allowed_countries: ['US', 'CA', 'MX', 'GB', 'DE', 'FR', 'ES', 'IT'],
          },
      // Pre-fill shipping address if provided
      ...(shippingAddress && {
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: {
                amount: 0, // Free shipping for now
                currency: currency.toLowerCase(),
              },
              display_name: 'Standard Shipping',
              delivery_estimate: {
                minimum: {
                  unit: 'business_day',
                  value: 5,
                },
                maximum: {
                  unit: 'business_day',
                  value: 7,
                },
              },
            },
          },
        ],
      }),
      metadata: {
        locale,
        cart_items: JSON.stringify(cartItems.map((item: any) => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
        }))),
      },
    });

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
