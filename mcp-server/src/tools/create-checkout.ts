import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';
import Stripe from 'stripe';
import { requiredEnv } from '../lib/env.js';

/**
 * MCP Tool: create_checkout
 *
 * Create a Stripe Checkout Session and return the URL.
 *
 * CRITICAL SECURITY RULE:
 * - This tool NEVER processes payments directly
 * - It ONLY creates a Checkout Session and returns the URL
 * - The user completes payment on Stripe's hosted checkout page
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 */

export const createCheckoutSchema = z.object({
  success_url: z.string().url().optional().describe('URL to redirect to after successful payment (default: store homepage)'),
  cancel_url: z.string().url().optional().describe('URL to redirect to if user cancels (default: cart page)'),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export interface CreateCheckoutResult {
  success: boolean;
  error?: string;
  checkout_url?: string;
  expires_at?: string;
}

const STRIPE_SECRET_KEY = requiredEnv('STRIPE_SECRET_KEY');
const FRONTEND_URL = requiredEnv('FRONTEND_URL');

type AllowedCountry = Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry;

/** Fetch unique country codes from active shipping zones */
async function getShippingCountries(supabase: any): Promise<AllowedCountry[]> {
  const fallback: AllowedCountry[] = ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'AU', 'AT', 'NL', 'BE', 'PT'];
  try {
    const { data } = await supabase
      .from('shipping_zones')
      .select('country_code')
      .eq('active', true);
    if (!data || data.length === 0) return fallback;
    const codes = [...new Set((data as any[]).map(z => z.country_code?.toUpperCase()).filter(Boolean))] as AllowedCountry[];
    return codes.length > 0 ? codes : fallback;
  } catch {
    return fallback;
  }
}

export async function createCheckout(
  input: CreateCheckoutInput,
  authInfo?: AuthInfo
): Promise<CreateCheckoutResult> {
  // Check authentication
  if (!authInfo || !authInfo.extra?.userId) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();

    // Fetch user's cart items with product details
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select(
        `
        id,
        product_id,
        variant_id,
        quantity,
        products:product_id (
          title,
          base_price_cents,
          currency,
          images
        ),
        product_variants:variant_id (
          title,
          price_cents
        )
      `
      )
      .eq('user_id', userId);

    if (cartError) {
      console.error('[create_checkout] Cart query error:', cartError);
      return {
        success: false,
        error: 'Failed to fetch cart items',
      };
    }

    if (!cartItems || cartItems.length === 0) {
      return {
        success: false,
        error: 'Cart is empty. Add items before creating checkout.',
      };
    }

    // Get user email for Stripe
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, locale')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('[create_checkout] User query error:', userError);
      return {
        success: false,
        error: 'Failed to fetch user information',
      };
    }

    // Create Stripe client
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });

    // Build line items for Stripe Checkout
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = cartItems.map((item: any) => {
      const product = item.products;
      const variant = item.product_variants;

      // Use variant price if available, otherwise product base price
      const unitPriceCents = variant?.price_cents || product?.base_price_cents || 0;
      const productName = product?.title || 'Unknown Product';
      const variantName = variant?.title ? ` (${variant.title})` : '';
      const fullName = `${productName}${variantName}`;

      // Get image URL (first image if available)
      const images = product?.images;
      const imageUrl = Array.isArray(images) && images.length > 0 ? images[0] : undefined;

      return {
        price_data: {
          currency: product?.currency || 'usd',
          product_data: {
            name: fullName,
            ...(imageUrl && { images: [imageUrl] }),
          },
          unit_amount: unitPriceCents,
        },
        quantity: item.quantity,
      };
    });

    // Determine URLs — validate against store domain to prevent open redirect
    const locale = userData.locale || 'en';
    const allowedOrigin = new URL(FRONTEND_URL).origin;
    const rawSuccessUrl = input.success_url || `${FRONTEND_URL}/${locale}/orders`;
    const rawCancelUrl = input.cancel_url || `${FRONTEND_URL}/${locale}/cart`;

    const successUrl = rawSuccessUrl.startsWith(allowedOrigin) ? rawSuccessUrl : `${FRONTEND_URL}/${locale}/orders`;
    const cancelUrl = rawCancelUrl.startsWith(allowedOrigin) ? rawCancelUrl : `${FRONTEND_URL}/${locale}/cart`;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userData.email,
      line_items: lineItems,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        locale,
      },
      // Allow promo codes
      allow_promotion_codes: true,
      // Billing address collection
      billing_address_collection: 'required',
      // Shipping address collection — countries from shipping_zones
      shipping_address_collection: {
        allowed_countries: await getShippingCountries(supabase),
      },
    });

    // IMPORTANT: We NEVER process payment here
    // We only return the checkout URL for the user to complete payment on Stripe

    return {
      success: true,
      checkout_url: session.url!,
      expires_at: new Date(session.expires_at * 1000).toISOString(),
    };
  } catch (err: any) {
    console.error('[create_checkout] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred while creating checkout',
    };
  }
}
