/**
 * Credit Pack Purchase API
 *
 * POST /api/credits/purchase
 * Creates a Stripe Checkout session for credit pack purchase.
 */

import { NextRequest } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { BASE_URL, BRAND } from '@/lib/store-config'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CREDIT_PACKS = {
  small:  { credits: 15,  priceCents: 499,  label: '15 Credits' },
  medium: { credits: 50,  priceCents: 1499, label: '50 Credits' },
  large:  { credits: 150, priceCents: 3999, label: '150 Credits' },
} as const

type PackSize = keyof typeof CREDIT_PACKS

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const body = await req.json()
    const { pack, locale: reqLocale } = body as { pack: string; locale?: string }
    const locale = reqLocale || 'en'

    if (!pack || !(pack in CREDIT_PACKS)) {
      return Response.json(
        { error: 'Invalid pack. Choose: small, medium, or large' },
        { status: 400 }
      )
    }

    const packInfo = CREDIT_PACKS[pack as PackSize]

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

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

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${BRAND.name} ${packInfo.label}`,
              description: `${packInfo.credits} design credits for AI-powered designs`,
            },
            unit_amount: packInfo.priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${BASE_URL}/${locale}/pricing?credits=success`,
      cancel_url: `${BASE_URL}/${locale}/pricing?credits=cancelled`,
      metadata: {
        user_id: user.id,
        type: 'credit_pack',
        pack,
        credits: String(packInfo.credits),
      },
    })

    return Response.json({ url: session.url })
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      return authErrorResponse(error)
    }
    console.error('Credit purchase error:', error)
    return Response.json({ error: 'Failed to create checkout' }, { status: 500 })
  }
}
