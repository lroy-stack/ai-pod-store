/**
 * Tax Calculation API
 *
 * POST /api/checkout/calculate-tax
 * Calculates tax for a cart using Stripe Tax
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateTax } from '@/lib/stripe';
import { STORE_DEFAULTS } from '@/lib/store-config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cartItems, shippingAddress, currency = STORE_DEFAULTS.stripeCurrency, shipping } = body;

    // Validate required fields
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Cart items are required' },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: 'Shipping address is required' },
        { status: 400 }
      );
    }

    // Validate shipping address fields
    const requiredFields = ['line1', 'city', 'state', 'postal_code', 'country'];
    for (const field of requiredFields) {
      if (!shippingAddress[field]) {
        return NextResponse.json(
          { error: `Shipping address ${field} is required` },
          { status: 400 }
        );
      }
    }

    // Calculate tax using Stripe Tax
    const result = await calculateTax({
      cartItems,
      shippingAddress,
      currency,
      shipping,
    });

    return NextResponse.json({
      success: true,
      tax: result.tax,
      total: result.total,
      breakdown: result.breakdown,
    });
  } catch (error) {
    console.error('Tax calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate tax' },
      { status: 500 }
    );
  }
}
