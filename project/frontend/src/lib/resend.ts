/**
 * Resend Email Service
 *
 * Handles transactional emails via Resend API
 */

import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY not configured — emails will not be sent')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Send order shipped email
 */
export async function sendOrderShippedEmail(params: {
  to: string
  orderId: string
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
  locale: string
}) {
  const { to, orderId, trackingNumber, trackingUrl, carrier, locale } = params

  // Locale-aware email content
  const subjects = {
    en: `Your order #${orderId} has shipped!`,
    es: `¡Tu pedido #${orderId} ha sido enviado!`,
    de: `Deine Bestellung #${orderId} wurde versandt!`,
  }

  const headings = {
    en: 'Your order is on its way! 📦',
    es: '¡Tu pedido está en camino! 📦',
    de: 'Deine Bestellung ist unterwegs! 📦',
  }

  const bodies = {
    en: trackingNumber
      ? `Your order has been shipped via ${carrier}. You can track your package using the tracking number: ${trackingNumber}`
      : `Your order has been shipped and is on its way to you!`,
    es: trackingNumber
      ? `Tu pedido ha sido enviado vía ${carrier}. Puedes rastrear tu paquete con el número de seguimiento: ${trackingNumber}`
      : `¡Tu pedido ha sido enviado y está en camino!`,
    de: trackingNumber
      ? `Deine Bestellung wurde via ${carrier} versandt. Du kannst dein Paket mit der Sendungsnummer verfolgen: ${trackingNumber}`
      : `Deine Bestellung wurde versandt und ist auf dem Weg zu dir!`,
  }

  const trackingTexts = {
    en: 'Track your package',
    es: 'Rastrear tu paquete',
    de: 'Paket verfolgen',
  }

  const subject = subjects[locale as keyof typeof subjects] || subjects.en
  const heading = headings[locale as keyof typeof headings] || headings.en
  const body = bodies[locale as keyof typeof bodies] || bodies.en
  const trackingText = trackingTexts[locale as keyof typeof trackingTexts] || trackingTexts.en

  try {
    const { data, error } = await resend.emails.send({
      from: 'POD AI Store <onboarding@resend.dev>',
      to,
      subject,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">POD AI Store</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #667eea; margin-top: 0;">${heading}</h2>

    <p style="font-size: 16px; margin: 20px 0;">${body}</p>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Order ID:</strong> ${orderId}</p>
      ${
        trackingNumber
          ? `<p style="margin: 0 0 10px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>`
          : ''
      }
      ${carrier ? `<p style="margin: 0;"><strong>Carrier:</strong> ${carrier}</p>` : ''}
    </div>

    ${
      trackingUrl
        ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${trackingUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">${trackingText}</a>
    </div>
    `
        : ''
    }

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      ${locale === 'es' ? 'Gracias por tu compra' : locale === 'de' ? 'Vielen Dank für deinen Einkauf' : 'Thank you for your purchase'}!
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: #9ca3af;">
    <p>POD AI Store — Your AI-powered print-on-demand marketplace</p>
  </div>
</body>
</html>
      `,
    })

    if (error) {
      console.error('Failed to send order shipped email:', error)
      return { success: false, error }
    }

    console.log('Order shipped email sent:', data?.id)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Exception sending order shipped email:', error)
    return { success: false, error }
  }
}
