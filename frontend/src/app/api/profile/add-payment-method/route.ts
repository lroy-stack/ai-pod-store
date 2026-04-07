/**
 * POST /api/profile/add-payment-method
 *
 * Create a Stripe Checkout Session in setup mode to save a card.
 * No payment is taken — only card details are collected and saved.
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { BASE_URL } from '@/lib/store-config'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Get or create Stripe customer
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        metadata: { user_id: user.id },
      })
      customerId = customer.id

      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Parse locale from request body or default
    const body = await req.json().catch(() => ({}))
    const locale = body.locale || 'en'

    // Create setup-only checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer: customerId,
      payment_method_types: ['card'],
      success_url: `${BASE_URL}/${locale}/profile?tab=orders&card=saved`,
      cancel_url: `${BASE_URL}/${locale}/profile?tab=orders`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const resp = authErrorResponse(error)
    if (resp) return resp
    console.error('[add-payment-method] Error:', error)
    return NextResponse.json({ error: 'Failed to create setup session' }, { status: 500 })
  }
}
