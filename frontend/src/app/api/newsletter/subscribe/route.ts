/**
 * POST /api/newsletter/subscribe
 *
 * Newsletter subscription with double opt-in (GDPR/UWG compliant).
 * Creates unconfirmed subscriber and sends confirmation email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import crypto from 'crypto'
import { BASE_URL, EMAIL_FROM } from '@/lib/store-config'
import { buildNewsletterConfirmEmail } from '@/lib/email-templates/newsletter-confirm'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const subscribeSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['en', 'es', 'de']).default('en'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = subscribeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email or locale' },
        { status: 400 }
      )
    }

    const { email, locale } = parsed.data

    // Generate cryptographically secure confirmation token
    const confirmationToken = crypto.randomBytes(32).toString('hex')

    // Check if subscriber already exists
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, confirmed_at')
      .eq('email', email)
      .single()

    if (existing) {
      if (existing.confirmed_at) {
        // Already confirmed - just return success (don't reveal this info)
        return NextResponse.json({ message: 'Confirmation email sent' })
      } else {
        // Update existing unconfirmed subscriber with new token
        await supabase
          .from('newsletter_subscribers')
          .update({
            confirmation_token: confirmationToken,
            locale,
          })
          .eq('email', email)
      }
    } else {
      // Create new subscriber (unconfirmed)
      const { error: insertError } = await supabase
        .from('newsletter_subscribers')
        .insert({
          email,
          locale,
          confirmation_token: confirmationToken,
          subscribed: true,
        })

      if (insertError) {
        console.error('[Newsletter] Insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to create subscription' },
          { status: 500 }
        )
      }
    }

    // Send confirmation email via Resend
    const confirmUrl = `${BASE_URL}/api/newsletter/confirm/${confirmationToken}`

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      console.error('[Newsletter] RESEND_API_KEY not configured')
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      )
    }

    // Build branded confirmation email using centralized template
    const { subject, html } = await buildNewsletterConfirmEmail({
      locale,
      recipientEmail: email,
      confirmUrl,
    })

    const { Resend } = await import('resend')
    const resend = new Resend(resendKey)
    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (sendError) {
      console.error('[Newsletter] Resend error:', sendError)
      return NextResponse.json(
        { error: 'Failed to send confirmation email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Confirmation email sent' })
  } catch (error) {
    console.error('[Newsletter] Subscribe error:', error)
    return NextResponse.json(
      { error: 'Subscription failed' },
      { status: 500 }
    )
  }
}
