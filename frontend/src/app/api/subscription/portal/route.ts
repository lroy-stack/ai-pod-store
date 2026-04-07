/**
 * Stripe Customer Portal API
 *
 * POST /api/subscription/portal
 * Creates a Stripe billing portal session and returns the URL.
 * Premium users can manage their subscription (cancel, update payment, etc.)
 */

import { NextRequest } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { BASE_URL } from '@/lib/store-config'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Only premium users have a Stripe customer to manage
    if (user.tier !== 'premium') {
      return Response.json(
        { error: 'Portal is only available for Premium subscribers.' },
        { status: 403 }
      )
    }

    // Fetch Stripe customer ID
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return Response.json(
        { error: 'No Stripe customer found for this account.' },
        { status: 404 }
      )
    }

    // Parse return URL from request body (fallback to profile page)
    let returnUrl = `${BASE_URL}/en/profile`
    try {
      const body = await req.json()
      if (body?.returnUrl) returnUrl = body.returnUrl
    } catch {
      // Body parsing is optional
    }

    // Create Stripe billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    })

    return Response.json({ url: session.url })
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      return authErrorResponse(error)
    }
    console.error('Subscription portal error:', error)
    return Response.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
