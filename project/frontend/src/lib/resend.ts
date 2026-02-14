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
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(params: {
  to: string
  orderId: string
  orderNumber: string
  itemCount: number
  totalCents: number
  currency: string
  locale: string
}) {
  const { to, orderId, orderNumber, itemCount, totalCents, currency, locale } = params

  const totalAmount = (totalCents / 100).toFixed(2)
  const currencyCode = currency.toUpperCase()

  // Locale-aware email content
  const subjects = {
    en: `Order Confirmation #${orderNumber}`,
    es: `Confirmación de Pedido #${orderNumber}`,
    de: `Bestellbestätigung #${orderNumber}`,
  }

  const headings = {
    en: 'Thank you for your order! 🎉',
    es: '¡Gracias por tu pedido! 🎉',
    de: 'Vielen Dank für deine Bestellung! 🎉',
  }

  const bodies = {
    en: `Your order has been confirmed and is being processed. You will receive another email when your order ships.`,
    es: `Tu pedido ha sido confirmado y está siendo procesado. Recibirás otro correo cuando tu pedido sea enviado.`,
    de: `Deine Bestellung wurde bestätigt und wird bearbeitet. Du erhältst eine weitere E-Mail, wenn deine Bestellung versandt wird.`,
  }

  const orderSummaryTexts = {
    en: 'Order Summary',
    es: 'Resumen del Pedido',
    de: 'Bestellübersicht',
  }

  const itemTexts = {
    en: itemCount === 1 ? 'item' : 'items',
    es: itemCount === 1 ? 'artículo' : 'artículos',
    de: itemCount === 1 ? 'Artikel' : 'Artikel',
  }

  const totalTexts = {
    en: 'Total',
    es: 'Total',
    de: 'Gesamt',
  }

  const footerTexts = {
    en: 'We will send you a shipping confirmation email with tracking information as soon as your order ships.',
    es: 'Te enviaremos un correo de confirmación de envío con información de rastreo tan pronto como tu pedido sea enviado.',
    de: 'Wir senden dir eine Versandbestätigungs-E-Mail mit Tracking-Informationen, sobald deine Bestellung versandt wird.',
  }

  const subject = subjects[locale as keyof typeof subjects] || subjects.en
  const heading = headings[locale as keyof typeof headings] || headings.en
  const body = bodies[locale as keyof typeof bodies] || bodies.en
  const orderSummaryText = orderSummaryTexts[locale as keyof typeof orderSummaryTexts] || orderSummaryTexts.en
  const itemText = itemTexts[locale as keyof typeof itemTexts] || itemTexts.en
  const totalText = totalTexts[locale as keyof typeof totalTexts] || totalTexts.en
  const footerText = footerTexts[locale as keyof typeof footerTexts] || footerTexts.en

  try {
    const { data, error } = await resend.emails.send({
      from: 'POD AI <onboarding@resend.dev>',
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
    <h1 style="margin: 0; font-size: 28px;">POD AI</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #667eea; margin-top: 0;">${heading}</h2>

    <p style="font-size: 16px; margin: 20px 0;">${body}</p>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; color: #667eea;">${orderSummaryText}</h3>
      <p style="margin: 0 0 10px 0;"><strong>${locale === 'es' ? 'Número de Pedido' : locale === 'de' ? 'Bestellnummer' : 'Order Number'}:</strong> #${orderNumber}</p>
      <p style="margin: 0 0 10px 0;"><strong>${itemCount} ${itemText}</strong></p>
      <p style="margin: 0; font-size: 18px; font-weight: bold; color: #667eea;"><strong>${totalText}:</strong> ${totalAmount} ${currencyCode}</p>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
      ${footerText}
    </p>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      ${locale === 'es' ? 'Gracias por tu compra' : locale === 'de' ? 'Vielen Dank für deinen Einkauf' : 'Thank you for your purchase'}!
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: #9ca3af;">
    <p>POD AI ${locale === 'es' ? '— Tu tienda de impresión bajo demanda impulsada por IA' : locale === 'de' ? '— Dein KI-gesteuerter Print-on-Demand-Marktplatz' : '— Your AI-powered print-on-demand marketplace'}</p>
  </div>
</body>
</html>
      `,
    })

    if (error) {
      console.error('Failed to send order confirmation email:', error)
      return { success: false, error }
    }

    console.log('Order confirmation email sent:', data?.id)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Exception sending order confirmation email:', error)
    return { success: false, error }
  }
}

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
      from: process.env.RESEND_FROM_EMAIL || 'POD AI Store <onboarding@resend.dev>',
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
