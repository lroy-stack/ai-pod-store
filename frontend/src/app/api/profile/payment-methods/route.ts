import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAuth, authErrorResponse } from '@/lib/auth-guard';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/profile/payment-methods
 *
 * Returns the authenticated user's saved payment methods from Stripe.
 * Requires authentication via sb-access-token cookie.
 *
 * Response includes card details: last4, brand, exp_month, exp_year
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Get user's Stripe customer ID from database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[GET /api/profile/payment-methods] Error fetching user:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    // If user has no Stripe customer ID, return empty list
    if (!profile?.stripe_customer_id) {
      return NextResponse.json({
        paymentMethods: [],
        message: 'No payment methods saved yet',
      });
    }

    // List payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: profile.stripe_customer_id,
      type: 'card',
    });

    // Format payment methods for response
    const formattedPaymentMethods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
        funding: pm.card.funding,
      } : null,
      created: pm.created,
    }));

    return NextResponse.json({
      paymentMethods: formattedPaymentMethods,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error);

    // Handle Stripe-specific errors gracefully — invalid customer returns empty list
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as any;
      if (stripeError.type === 'StripeInvalidRequestError') {
        console.warn('[payment-methods] Invalid Stripe customer, returning empty:', stripeError.message);
        return NextResponse.json({ paymentMethods: [] });
      }
    }

    console.error('[GET /api/profile/payment-methods] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
