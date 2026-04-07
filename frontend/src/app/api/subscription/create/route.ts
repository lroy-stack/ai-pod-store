/**
 * Subscription Create API
 *
 * POST /api/subscription/create
 * Creates a Stripe Checkout session for premium subscription.
 */

import { NextRequest } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { BASE_URL } from '@/lib/store-config'
import { subscriptionCreateLimiter } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_PREMIUM_PRICE_ID) {
      console.error('STRIPE_PREMIUM_PRICE_ID environment variable is not configured')
      return Response.json(
        { error: 'Subscription service is not configured' },
        { status: 503 }
      )
    }

    const user = await requireAuth(req)

    // Per-user rate limit: 3 checkout sessions/hour to prevent Stripe session spam
    const rateLimit = subscriptionCreateLimiter.check(`sub-create:${user.id}`)
    if (!rateLimit.success) {
      return Response.json(
        { error: 'Too many subscription requests. Please wait before trying again.' },
        { status: 429 }
      )
    }

    // Check if user already has an active subscription
    const { data: profile } = await supabase
      .from('users')
      .select('subscription_status, stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profile?.subscription_status === 'active') {
      return Response.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      })
      customerId = customer.id

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Extract locale from request body, default to 'en'
    const body = await req.json().catch(() => ({}))
    const locale = body.locale || 'en'

    // Create checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${BASE_URL}/${locale}/pricing?success=true`,
      cancel_url: `${BASE_URL}/${locale}/pricing?cancelled=true`,
      metadata: {
        user_id: user.id,
        type: 'subscription',
      },
    })

    return Response.json({ url: session.url })
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      return authErrorResponse(error)
    }
    console.error('Subscription create error:', error)
    return Response.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}
