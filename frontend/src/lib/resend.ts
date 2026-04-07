/**
 * Resend Email Service
 *
 * Handles transactional emails via Resend API
 */

import { Resend } from 'resend'
import { getBrandConfig } from '@/lib/brand-config-server'
import { BASE_URL, BRAND, COMPANY, CONTACT, EMAIL_PALETTE, EMAIL_FROM } from '@/lib/store-config'
import { emailLayout } from '@/lib/email-layout'

/** Email colors — re-exported from store-config for template use */
const EMAIL_COLORS = EMAIL_PALETTE

const COMPANY_INFO = {
  name: BRAND.name,
  address: COMPANY.address,
  email: CONTACT.general,
} as const

let _resend: Resend | undefined

function initResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured — emails will not be sent')
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

// Lazy singleton — client is created on first property access, not at import time.
export const resend: Resend = new Proxy({} as Resend, {
  get(_, prop) {
    const client = initResend()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

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

  const { brandName, brandTagline } = await getBrandConfig()
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
      from: EMAIL_FROM,
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${EMAIL_COLORS.bodyText}; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${EMAIL_COLORS.headerBg}; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">${brandName}</h1>
  </div>

  <div style="background: ${EMAIL_COLORS.panelBg}; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: ${EMAIL_COLORS.heading}; margin-top: 0;">${heading}</h2>

    <p style="font-size: 16px; margin: 20px 0;">${body}</p>

    <div style="background: white; border: 1px solid ${EMAIL_COLORS.cardBorder}; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; color: ${EMAIL_COLORS.heading};">${orderSummaryText}</h3>
      <p style="margin: 0 0 10px 0;"><strong>${locale === 'es' ? 'Número de Pedido' : locale === 'de' ? 'Bestellnummer' : 'Order Number'}:</strong> #${orderNumber}</p>
      <p style="margin: 0 0 10px 0;"><strong>${itemCount} ${itemText}</strong></p>
      <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${EMAIL_COLORS.heading};"><strong>${totalText}:</strong> ${totalAmount} ${currencyCode}</p>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 20px; padding: 15px; background: ${EMAIL_COLORS.warningBg}; border-left: 4px solid ${EMAIL_COLORS.warningBorder}; border-radius: 4px;">
      ${footerText}
    </p>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 30px;">
      ${locale === 'es' ? 'Gracias por tu compra' : locale === 'de' ? 'Vielen Dank für deinen Einkauf' : 'Thank you for your purchase'}!
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: ${EMAIL_COLORS.footerText};">
    <p>${brandName} — ${brandTagline}</p>
  </div>

  <p style="color: ${EMAIL_COLORS.footerText}; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
    ${COMPANY_INFO.name} | ${COMPANY_INFO.address}<br/>
    <a href="${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(params.to)}" style="color: ${EMAIL_COLORS.footerText};">Manage preferences</a>
  </p>
</body>
</html>
      `,
      headers: {
        'List-Unsubscribe': `<${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(to)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
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

  const { brandName, brandTagline } = await getBrandConfig()

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
      from: EMAIL_FROM,
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${EMAIL_COLORS.bodyText}; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${EMAIL_COLORS.headerBg}; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">${brandName}</h1>
  </div>

  <div style="background: ${EMAIL_COLORS.panelBg}; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: ${EMAIL_COLORS.heading}; margin-top: 0;">${heading}</h2>

    <p style="font-size: 16px; margin: 20px 0;">${body}</p>

    <div style="background: white; border: 1px solid ${EMAIL_COLORS.cardBorder}; border-radius: 6px; padding: 20px; margin: 20px 0;">
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
      <a href="${trackingUrl}" style="display: inline-block; background: ${EMAIL_COLORS.ctaButton}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">${trackingText}</a>
    </div>
    `
        : ''
    }

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 30px;">
      ${locale === 'es' ? 'Gracias por tu compra' : locale === 'de' ? 'Vielen Dank für deinen Einkauf' : 'Thank you for your purchase'}!
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: ${EMAIL_COLORS.footerText};">
    <p>${brandName} — ${brandTagline}</p>
  </div>

  <p style="color: ${EMAIL_COLORS.footerText}; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
    ${COMPANY_INFO.name} | ${COMPANY_INFO.address}<br/>
    <a href="${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(params.to)}" style="color: ${EMAIL_COLORS.footerText};">Manage preferences</a>
  </p>
</body>
</html>
      `,
      headers: {
        'List-Unsubscribe': `<${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(to)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
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

/**
 * Send order cancelled and refunded email
 */
export async function sendOrderCancelledEmail(params: {
  to: string
  orderId: string
  refundAmount: number
  currency: string
  reason: string
  locale: string
}) {
  const { to, orderId, refundAmount, currency, reason, locale } = params

  const { brandName, brandTagline } = await getBrandConfig()
  const refundAmountFormatted = (refundAmount / 100).toFixed(2)
  const currencyCode = currency.toUpperCase()

  // Locale-aware email content
  const subjects = {
    en: `Order #${orderId} Cancelled and Refunded`,
    es: `Pedido #${orderId} Cancelado y Reembolsado`,
    de: `Bestellung #${orderId} Storniert und Erstattet`,
  }

  const headings = {
    en: 'Your order has been cancelled',
    es: 'Tu pedido ha sido cancelado',
    de: 'Deine Bestellung wurde storniert',
  }

  const bodies = {
    en: `We're sorry, but your order has been cancelled by our fulfillment partner. A full refund has been issued to your original payment method.`,
    es: `Lo sentimos, pero tu pedido ha sido cancelado por nuestro socio de fulfillment. Se ha emitido un reembolso completo a tu método de pago original.`,
    de: `Es tut uns leid, aber deine Bestellung wurde von unserem Fulfillment-Partner storniert. Eine vollständige Rückerstattung wurde auf deine ursprüngliche Zahlungsmethode ausgestellt.`,
  }

  const refundDetailsTexts = {
    en: 'Refund Details',
    es: 'Detalles del Reembolso',
    de: 'Erstattungsdetails',
  }

  const orderIdTexts = {
    en: 'Order ID',
    es: 'ID del Pedido',
    de: 'Bestellnummer',
  }

  const refundAmountTexts = {
    en: 'Refund Amount',
    es: 'Monto Reembolsado',
    de: 'Erstattungsbetrag',
  }

  const reasonTexts = {
    en: 'Reason',
    es: 'Razón',
    de: 'Grund',
  }

  const footerTexts = {
    en: 'The refund will appear on your statement within 5-10 business days. If you have any questions, please contact our support team.',
    es: 'El reembolso aparecerá en tu estado de cuenta dentro de 5-10 días hábiles. Si tienes alguna pregunta, por favor contacta a nuestro equipo de soporte.',
    de: 'Die Erstattung wird innerhalb von 5-10 Werktagen auf deinem Kontoauszug erscheinen. Bei Fragen wende dich bitte an unser Support-Team.',
  }

  const subject = subjects[locale as keyof typeof subjects] || subjects.en
  const heading = headings[locale as keyof typeof headings] || headings.en
  const body = bodies[locale as keyof typeof bodies] || bodies.en
  const refundDetailsText = refundDetailsTexts[locale as keyof typeof refundDetailsTexts] || refundDetailsTexts.en
  const orderIdText = orderIdTexts[locale as keyof typeof orderIdTexts] || orderIdTexts.en
  const refundAmountText = refundAmountTexts[locale as keyof typeof refundAmountTexts] || refundAmountTexts.en
  const reasonText = reasonTexts[locale as keyof typeof reasonTexts] || reasonTexts.en
  const footerText = footerTexts[locale as keyof typeof footerTexts] || footerTexts.en

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${EMAIL_COLORS.bodyText}; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${EMAIL_COLORS.headerBg}; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">${brandName}</h1>
  </div>

  <div style="background: ${EMAIL_COLORS.panelBg}; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: ${EMAIL_COLORS.heading}; margin-top: 0;">${heading}</h2>

    <p style="font-size: 16px; margin: 20px 0;">${body}</p>

    <div style="background: white; border: 1px solid ${EMAIL_COLORS.cardBorder}; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; color: ${EMAIL_COLORS.heading};">${refundDetailsText}</h3>
      <p style="margin: 0 0 10px 0;"><strong>${orderIdText}:</strong> #${orderId}</p>
      <p style="margin: 0 0 10px 0;"><strong>${refundAmountText}:</strong> ${refundAmountFormatted} ${currencyCode}</p>
      <p style="margin: 0;"><strong>${reasonText}:</strong> ${reason}</p>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 20px; padding: 15px; background: ${EMAIL_COLORS.warningBg}; border-left: 4px solid ${EMAIL_COLORS.warningBorder}; border-radius: 4px;">
      ${footerText}
    </p>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 30px;">
      ${locale === 'es' ? 'Lamentamos las molestias' : locale === 'de' ? 'Wir entschuldigen uns für die Unannehmlichkeiten' : 'We apologize for the inconvenience'}.
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: ${EMAIL_COLORS.footerText};">
    <p>${brandName} — ${brandTagline}</p>
  </div>

  <p style="color: ${EMAIL_COLORS.footerText}; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
    ${COMPANY_INFO.name} | ${COMPANY_INFO.address}<br/>
    <a href="${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(params.to)}" style="color: ${EMAIL_COLORS.footerText};">Manage preferences</a>
  </p>
</body>
</html>
      `,
      headers: {
        'List-Unsubscribe': `<${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(to)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (error) {
      console.error('Failed to send order cancelled email:', error)
      return { success: false, error }
    }

    console.log('Order cancelled email sent:', data?.id)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Exception sending order cancelled email:', error)
    return { success: false, error }
  }
}

/**
 * Send order delivered email
 */
export async function sendOrderDeliveredEmail(params: {
  to: string
  orderId: string
  orderNumber: string
  locale: string
}) {
  const { to, orderId, orderNumber, locale } = params

  const { brandName, brandTagline } = await getBrandConfig()
  const baseUrl = BASE_URL

  // Locale-aware email content
  const subjects = {
    en: `Your order #${orderNumber} has been delivered!`,
    es: `¡Tu pedido #${orderNumber} ha sido entregado!`,
    de: `Deine Bestellung #${orderNumber} wurde zugestellt!`,
  }

  const headings = {
    en: 'Your order has been delivered! 🎉',
    es: '¡Tu pedido ha sido entregado! 🎉',
    de: 'Deine Bestellung wurde zugestellt! 🎉',
  }

  const bodies = {
    en: `Great news! Your order #${orderNumber} has been delivered. We hope you love your new items!`,
    es: `¡Buenas noticias! Tu pedido #${orderNumber} ha sido entregado. ¡Esperamos que te encanten tus nuevos artículos!`,
    de: `Gute Nachrichten! Deine Bestellung #${orderNumber} wurde zugestellt. Wir hoffen, dass dir deine neuen Artikel gefallen!`,
  }

  const reviewTexts = {
    en: 'Leave a Review',
    es: 'Dejar una Reseña',
    de: 'Bewertung Abgeben',
  }

  const reviewPromptTexts = {
    en: 'Enjoyed your purchase? We would love to hear your feedback! Leave a review and help other customers find their perfect products.',
    es: '¿Te gustó tu compra? ¡Nos encantaría conocer tu opinión! Deja una reseña y ayuda a otros clientes a encontrar sus productos perfectos.',
    de: 'Hat dir dein Kauf gefallen? Wir würden uns über dein Feedback freuen! Hinterlasse eine Bewertung und hilf anderen Kunden, ihre perfekten Produkte zu finden.',
  }

  const supportTexts = {
    en: 'If you have any issues with your order, please don\'t hesitate to contact our support team.',
    es: 'Si tienes algún problema con tu pedido, no dudes en contactar a nuestro equipo de soporte.',
    de: 'Wenn du Probleme mit deiner Bestellung hast, zögere nicht, unser Support-Team zu kontaktieren.',
  }

  const contactSupportTexts = {
    en: 'Contact Support',
    es: 'Contactar Soporte',
    de: 'Support Kontaktieren',
  }

  const subject = subjects[locale as keyof typeof subjects] || subjects.en
  const heading = headings[locale as keyof typeof headings] || headings.en
  const body = bodies[locale as keyof typeof bodies] || bodies.en
  const reviewText = reviewTexts[locale as keyof typeof reviewTexts] || reviewTexts.en
  const reviewPromptText = reviewPromptTexts[locale as keyof typeof reviewPromptTexts] || reviewPromptTexts.en
  const supportText = supportTexts[locale as keyof typeof supportTexts] || supportTexts.en
  const contactSupportText = contactSupportTexts[locale as keyof typeof contactSupportTexts] || contactSupportTexts.en

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${EMAIL_COLORS.bodyText}; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${EMAIL_COLORS.headerBg}; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">${brandName}</h1>
  </div>

  <div style="background: ${EMAIL_COLORS.panelBg}; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: ${EMAIL_COLORS.heading}; margin-top: 0;">${heading}</h2>

    <p style="font-size: 16px; margin: 20px 0;">${body}</p>

    <div style="background: white; border: 1px solid ${EMAIL_COLORS.cardBorder}; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>${locale === 'es' ? 'Número de Pedido' : locale === 'de' ? 'Bestellnummer' : 'Order Number'}:</strong> #${orderNumber}</p>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 20px; padding: 15px; background: ${EMAIL_COLORS.warningBg}; border-left: 4px solid ${EMAIL_COLORS.warningBorder}; border-radius: 4px;">
      ${reviewPromptText}
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${baseUrl}/${locale}/shop" style="display: inline-block; background: ${EMAIL_COLORS.ctaButton}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">${reviewText}</a>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 20px;">
      ${supportText}
    </p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${baseUrl}/${locale}/contact" style="display: inline-block; background: white; color: ${EMAIL_COLORS.ctaButton}; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; border: 2px solid ${EMAIL_COLORS.ctaButton};">${contactSupportText}</a>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 30px;">
      ${locale === 'es' ? 'Gracias por tu compra' : locale === 'de' ? 'Vielen Dank für deinen Einkauf' : 'Thank you for your purchase'}!
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: ${EMAIL_COLORS.footerText};">
    <p>${brandName} — ${brandTagline}</p>
  </div>

  <p style="color: ${EMAIL_COLORS.footerText}; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
    ${COMPANY_INFO.name} | ${COMPANY_INFO.address}<br/>
    <a href="${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(params.to)}" style="color: ${EMAIL_COLORS.footerText};">Manage preferences</a>
  </p>
</body>
</html>
      `,
      headers: {
        'List-Unsubscribe': `<${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(to)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (error) {
      console.error('Failed to send order delivered email:', error)
      return { success: false, error }
    }

    console.log('Order delivered email sent:', data?.id)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Exception sending order delivered email:', error)
    return { success: false, error }
  }
}

/**
 * Send order failed email
 */
export async function sendOrderFailedEmail(params: {
  to: string
  orderId: string
  orderNumber: string
  locale: string
}) {
  const { to, orderId, orderNumber, locale } = params

  const { brandName, brandTagline } = await getBrandConfig()
  const baseUrl = BASE_URL

  // Locale-aware email content
  const subjects = {
    en: `Issue with your order #${orderNumber}`,
    es: `Problema con tu pedido #${orderNumber}`,
    de: `Problem mit deiner Bestellung #${orderNumber}`,
  }

  const headings = {
    en: 'There was an issue with your order',
    es: 'Ha habido un problema con tu pedido',
    de: 'Es gab ein Problem mit deiner Bestellung',
  }

  const bodies = {
    en: `We're sorry, but there was an issue processing your order #${orderNumber}. A full refund has been issued to your original payment method.`,
    es: `Lo sentimos, pero ha habido un problema al procesar tu pedido #${orderNumber}. Se ha emitido un reembolso completo a tu método de pago original.`,
    de: `Es tut uns leid, aber es gab ein Problem bei der Bearbeitung deiner Bestellung #${orderNumber}. Eine vollständige Rückerstattung wurde auf deine ursprüngliche Zahlungsmethode ausgestellt.`,
  }

  const footerTexts = {
    en: 'The refund will appear on your statement within 5-10 business days. If you have any questions, please contact our support team.',
    es: 'El reembolso aparecerá en tu estado de cuenta dentro de 5-10 días hábiles. Si tienes alguna pregunta, por favor contacta a nuestro equipo de soporte.',
    de: 'Die Erstattung wird innerhalb von 5-10 Werktagen auf deinem Kontoauszug erscheinen. Bei Fragen wende dich bitte an unser Support-Team.',
  }

  const contactSupportTexts = {
    en: 'Contact Support',
    es: 'Contactar Soporte',
    de: 'Support Kontaktieren',
  }

  const subject = subjects[locale as keyof typeof subjects] || subjects.en
  const heading = headings[locale as keyof typeof headings] || headings.en
  const body = bodies[locale as keyof typeof bodies] || bodies.en
  const footerText = footerTexts[locale as keyof typeof footerTexts] || footerTexts.en
  const contactSupportText = contactSupportTexts[locale as keyof typeof contactSupportTexts] || contactSupportTexts.en

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${EMAIL_COLORS.bodyText}; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${EMAIL_COLORS.headerBg}; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">${brandName}</h1>
  </div>

  <div style="background: ${EMAIL_COLORS.panelBg}; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: ${EMAIL_COLORS.heading}; margin-top: 0;">${heading}</h2>

    <p style="font-size: 16px; margin: 20px 0;">${body}</p>

    <div style="background: white; border: 1px solid ${EMAIL_COLORS.cardBorder}; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>${locale === 'es' ? 'Número de Pedido' : locale === 'de' ? 'Bestellnummer' : 'Order Number'}:</strong> #${orderNumber}</p>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 20px; padding: 15px; background: ${EMAIL_COLORS.warningBg}; border-left: 4px solid ${EMAIL_COLORS.warningBorder}; border-radius: 4px;">
      ${footerText}
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${baseUrl}/${locale}/contact" style="display: inline-block; background: ${EMAIL_COLORS.ctaButton}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">${contactSupportText}</a>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 30px;">
      ${locale === 'es' ? 'Lamentamos las molestias' : locale === 'de' ? 'Wir entschuldigen uns für die Unannehmlichkeiten' : 'We apologize for the inconvenience'}.
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: ${EMAIL_COLORS.footerText};">
    <p>${brandName} — ${brandTagline}</p>
  </div>

  <p style="color: ${EMAIL_COLORS.footerText}; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
    ${COMPANY_INFO.name} | ${COMPANY_INFO.address}<br/>
    <a href="${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(params.to)}" style="color: ${EMAIL_COLORS.footerText};">Manage preferences</a>
  </p>
</body>
</html>
      `,
      headers: {
        'List-Unsubscribe': `<${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(to)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (error) {
      console.error('Failed to send order failed email:', error)
      return { success: false, error }
    }

    console.log('Order failed email sent:', data?.id)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Exception sending order failed email:', error)
    return { success: false, error }
  }
}

/**
 * Send credit pack purchase confirmation email
 */
export async function sendCreditPurchaseEmail(params: {
  to: string
  credits: number
  priceCents: number
  currency: string
  newBalance: number
  locale: string
}) {
  const { to, credits, priceCents, currency, newBalance, locale } = params

  const { brandName, brandTagline } = await getBrandConfig()
  const priceAmount = (priceCents / 100).toFixed(2)
  const currencyCode = currency.toUpperCase()

  // Locale-aware email content
  const subjects = {
    en: `Credit Purchase Confirmed — ${credits} Credits Added`,
    es: `Compra de Créditos Confirmada — ${credits} Créditos Añadidos`,
    de: `Kauf von Credits Bestätigt — ${credits} Credits Hinzugefügt`,
  }

  const headings = {
    en: 'Credits added successfully! 🎉',
    es: '¡Créditos añadidos con éxito! 🎉',
    de: 'Credits erfolgreich hinzugefügt! 🎉',
  }

  const bodies = {
    en: `Your purchase of ${credits} design credits has been confirmed. Your credits are ready to use!`,
    es: `Tu compra de ${credits} créditos de diseño ha sido confirmada. ¡Tus créditos están listos para usar!`,
    de: `Dein Kauf von ${credits} Design-Credits wurde bestätigt. Deine Credits sind bereit zur Nutzung!`,
  }

  const purchaseSummaryTexts = {
    en: 'Purchase Summary',
    es: 'Resumen de Compra',
    de: 'Kaufzusammenfassung',
  }

  const creditsAddedTexts = {
    en: 'Credits Added',
    es: 'Créditos Añadidos',
    de: 'Hinzugefügte Credits',
  }

  const newBalanceTexts = {
    en: 'New Balance',
    es: 'Nuevo Saldo',
    de: 'Neuer Saldo',
  }

  const amountPaidTexts = {
    en: 'Amount Paid',
    es: 'Monto Pagado',
    de: 'Gezahlter Betrag',
  }

  const useCreditsTexts = {
    en: 'Start Creating',
    es: 'Empezar a Crear',
    de: 'Mit Erstellen Beginnen',
  }

  const footerTexts = {
    en: 'Use your credits to generate AI-powered designs, product mockups, and more. Your credits never expire!',
    es: 'Usa tus créditos para generar diseños impulsados por IA, maquetas de productos y más. ¡Tus créditos nunca caducan!',
    de: 'Verwende deine Credits, um KI-gestützte Designs, Produktmockups und mehr zu generieren. Deine Credits verfallen nie!',
  }

  const subject = subjects[locale as keyof typeof subjects] || subjects.en
  const heading = headings[locale as keyof typeof headings] || headings.en
  const body = bodies[locale as keyof typeof bodies] || bodies.en
  const purchaseSummaryText = purchaseSummaryTexts[locale as keyof typeof purchaseSummaryTexts] || purchaseSummaryTexts.en
  const creditsAddedText = creditsAddedTexts[locale as keyof typeof creditsAddedTexts] || creditsAddedTexts.en
  const newBalanceText = newBalanceTexts[locale as keyof typeof newBalanceTexts] || newBalanceTexts.en
  const amountPaidText = amountPaidTexts[locale as keyof typeof amountPaidTexts] || amountPaidTexts.en
  const useCreditsText = useCreditsTexts[locale as keyof typeof useCreditsTexts] || useCreditsTexts.en
  const footerText = footerTexts[locale as keyof typeof footerTexts] || footerTexts.en

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${EMAIL_COLORS.bodyText}; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${EMAIL_COLORS.headerBg}; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">${brandName}</h1>
  </div>

  <div style="background: ${EMAIL_COLORS.panelBg}; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: ${EMAIL_COLORS.heading}; margin-top: 0;">${heading}</h2>

    <p style="font-size: 16px; margin: 20px 0;">${body}</p>

    <div style="background: white; border: 1px solid ${EMAIL_COLORS.cardBorder}; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; color: ${EMAIL_COLORS.heading};">${purchaseSummaryText}</h3>
      <p style="margin: 0 0 10px 0;"><strong>${creditsAddedText}:</strong> ${credits} credits</p>
      <p style="margin: 0 0 10px 0;"><strong>${newBalanceText}:</strong> ${newBalance} credits</p>
      <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${EMAIL_COLORS.heading};"><strong>${amountPaidText}:</strong> ${priceAmount} ${currencyCode}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${BASE_URL}/en/chat" style="display: inline-block; background: ${EMAIL_COLORS.ctaButton}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">${useCreditsText}</a>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 20px; padding: 15px; background: ${EMAIL_COLORS.warningBg}; border-left: 4px solid ${EMAIL_COLORS.warningBorder}; border-radius: 4px;">
      ${footerText}
    </p>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 30px;">
      ${locale === 'es' ? 'Gracias por tu compra' : locale === 'de' ? 'Vielen Dank für deinen Einkauf' : 'Thank you for your purchase'}!
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: ${EMAIL_COLORS.footerText};">
    <p>${brandName} — ${brandTagline}</p>
  </div>

  <p style="color: ${EMAIL_COLORS.footerText}; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
    ${COMPANY_INFO.name} | ${COMPANY_INFO.address}<br/>
    <a href="${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(params.to)}" style="color: ${EMAIL_COLORS.footerText};">Manage preferences</a>
  </p>
</body>
</html>
      `,
      headers: {
        'List-Unsubscribe': `<${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(to)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (error) {
      console.error('Failed to send credit purchase email:', error)
      return { success: false, error }
    }

    console.log('Credit purchase email sent:', data?.id)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Exception sending credit purchase email:', error)
    return { success: false, error }
  }
}

/**
 * Send welcome email after email verification with WELCOME10 coupon.
 * Template logic lives in email-templates/welcome.ts — this is just the send wrapper.
 */
export async function sendWelcomeEmail(params: {
  to: string
  name: string
  locale: string
}) {
  const { buildWelcomeEmail } = await import('@/lib/email-templates/welcome')

  try {
    const { subject, html } = await buildWelcomeEmail({
      name: params.name,
      locale: params.locale,
      recipientEmail: params.to,
    })

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject,
      html,
    })

    if (error) {
      console.error('Failed to send welcome email:', error)
      return { success: false, error }
    }

    console.log('Welcome email sent:', data?.id)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Exception sending welcome email:', error)
    return { success: false, error }
  }
}
