/**
 * Stripe Server-Side Client
 *
 * This module provides a singleton Stripe client for server-side operations.
 * Uses the Stripe Secret Key from environment variables.
 */

import Stripe from 'stripe';

let _stripe: Stripe | undefined;

function initStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
    }

    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return _stripe;
}

// Lazy singleton — client is created on first property access, not at import time.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    const client = initStripe();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

/**
 * Calculate tax for a cart using Stripe Tax
 *
 * @param params Tax calculation parameters
 * @returns Tax calculation result
 */
export async function calculateTax(params: {
  cartItems: Array<{
    productId: string;
    name: string;
    amount: number; // in cents
    quantity: number;
  }>;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  currency: string;
  shipping?: number; // in cents
}): Promise<{
  tax: number; // in cents
  total: number; // in cents
  breakdown?: Stripe.Tax.Calculation['tax_breakdown'];
}> {
  try {
    const lineItems: Stripe.Tax.CalculationCreateParams.LineItem[] = params.cartItems.map(
      (item) => ({
        amount: item.amount,
        quantity: item.quantity,
        reference: item.productId,
        tax_code: 'txcd_20030000', // Apparel - general category for POD products
      })
    );

    // Add shipping as a line item if provided
    if (params.shipping && params.shipping > 0) {
      lineItems.push({
        amount: params.shipping,
        quantity: 1,
        reference: 'shipping',
        tax_code: 'txcd_92010001', // Shipping - taxable
      });
    }

    const calculation = await stripe.tax.calculations.create({
      currency: params.currency.toLowerCase(),
      line_items: lineItems,
      customer_details: {
        address: {
          line1: params.shippingAddress.line1,
          line2: params.shippingAddress.line2 || undefined,
          city: params.shippingAddress.city,
          state: params.shippingAddress.state,
          postal_code: params.shippingAddress.postal_code,
          country: params.shippingAddress.country,
        },
        address_source: 'shipping',
      },
    });

    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.amount * (item.quantity || 1),
      0
    );

    return {
      tax: calculation.tax_amount_exclusive,
      total: subtotal + calculation.tax_amount_exclusive,
      breakdown: calculation.tax_breakdown,
    };
  } catch (error) {
    console.error('Stripe Tax calculation error:', error);

    // If Stripe Tax is not activated, fail with clear error (EU VAT is mandatory)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'stripe_tax_inactive') {
      console.error('CRITICAL: Stripe Tax is not activated. EU VAT compliance requires Stripe Tax. Activate at: https://dashboard.stripe.com/tax');
      throw new Error('Tax calculation unavailable. Stripe Tax must be activated for EU VAT compliance.');
    }

    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    throw error;
  }
}
