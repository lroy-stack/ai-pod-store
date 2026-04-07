/**
 * DELETE /api/profile/payment-methods/[id]
 * Detach a payment method from the authenticated user's Stripe customer.
 * Verifies ownership before detaching.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentMethodId } = await params
    const user = await requireAuth(request)

    // Get user's Stripe customer ID
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 })
    }

    // Verify ownership: the payment method must belong to this customer
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (pm.customer !== profile.stripe_customer_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Detach the payment method
    await stripe.paymentMethods.detach(paymentMethodId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)

    if (error instanceof Error && 'type' in error) {
      const stripeError = error as { type: string; message: string }
      if (stripeError.type === 'StripeInvalidRequestError') {
        return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
      }
    }

    console.error('[DELETE /api/profile/payment-methods/[id]] Error:', error)
    return NextResponse.json({ error: 'Failed to remove payment method' }, { status: 500 })
  }
}
