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

    // Localized confirmation email content
    const emailContent = {
      en: {
        subject: 'Confirm your newsletter subscription',
        body: `
          <h1>Confirm Your Subscription</h1>
          <p>Thanks for subscribing to Skapara newsletter!</p>
          <p>Please confirm your email address by clicking the link below:</p>
          <p><a href="${confirmUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">Confirm Subscription</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #666;">${confirmUrl}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            If you didn't request this, you can safely ignore this email.
          </p>
        `,
      },
      es: {
        subject: 'Confirma tu suscripción al boletín',
        body: `
          <h1>Confirma tu suscripción</h1>
          <p>¡Gracias por suscribirte al boletín de Skapara!</p>
          <p>Por favor confirma tu dirección de correo electrónico haciendo clic en el siguiente enlace:</p>
          <p><a href="${confirmUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">Confirmar suscripción</a></p>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="font-size: 12px; color: #666;">${confirmUrl}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            Si no solicitaste esto, puedes ignorar este correo de forma segura.
          </p>
        `,
      },
      de: {
        subject: 'Bestätigen Sie Ihr Newsletter-Abonnement',
        body: `
          <h1>Bestätigen Sie Ihr Abonnement</h1>
          <p>Vielen Dank für Ihr Abonnement des Skapara Newsletters!</p>
          <p>Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf den folgenden Link klicken:</p>
          <p><a href="${confirmUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">Abonnement bestätigen</a></p>
          <p>Oder kopieren Sie diesen Link in Ihren Browser:</p>
          <p style="font-size: 12px; color: #666;">${confirmUrl}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            Wenn Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren.
          </p>
        `,
      },
    }

    const content = emailContent[locale]

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject: content.subject,
        html: content.body,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Newsletter] Resend error:', errorText)
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
