/**
 * Billing Portal API
 *
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session for authenticated users.
 * The Customer Portal allows users to manage their subscription, payment methods, and invoices.
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

    // Look up stripe_customer_id from users table
    const { data: profile, error: fetchError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (fetchError || !profile) {
      return Response.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    if (!profile.stripe_customer_id) {
      return Response.json(
        { error: 'No Stripe customer ID found. Please subscribe first.' },
        { status: 400 }
      )
    }

    // Extract locale from request body, default to 'en'
    const body = await req.json().catch(() => ({}))
    const locale = body.locale || 'en'

    // Create a Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${BASE_URL}/${locale}/settings/billing`,
    })

    return Response.json({ url: session.url })
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      return authErrorResponse(error)
    }
    console.error('Billing portal error:', error)
    return Response.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    )
  }
}
