/**
 * Resend Email Service
 *
 * Handles transactional emails via Resend API
 */

import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

/** Centralized email color palette — update here to match brand theme */
const EMAIL_COLORS = {
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
  heading: '#667eea',
  ctaButton: '#667eea',
  bodyText: '#333',
  mutedText: '#6b7280',
  footerText: '#9ca3af',
  panelBg: '#f9fafb',
  cardBorder: '#e5e7eb',
  warningBg: '#fef3c7',
  warningBorder: '#f59e0b',
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
 * Fetch brand configuration from database
 * Returns brand_name and brand_tagline for use in emails
 */
async function getBrandConfig(): Promise<{ brandName: string; brandTagline: string }> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data, error } = await supabase
      .from('brand_config')
      .select('brand_name, brand_tagline')
      .eq('is_active', true)
      .single()

    if (error || !data) {
      console.warn('Failed to fetch brand config, using fallback:', error)
      return { brandName: 'Skapara', brandTagline: 'AI-Powered Print on Demand' }
    }

    return { brandName: data.brand_name, brandTagline: data.brand_tagline }
  } catch (error) {
    console.error('Exception fetching brand config:', error)
    return { brandName: 'Skapara', brandTagline: 'AI-Powered Print on Demand' }
  }
}

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
      from: `${brandName} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
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
  <div style="background: linear-gradient(135deg, ${EMAIL_COLORS.gradientStart} 0%, ${EMAIL_COLORS.gradientEnd} 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
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
      from: `${brandName} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
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
  <div style="background: linear-gradient(135deg, ${EMAIL_COLORS.gradientStart} 0%, ${EMAIL_COLORS.gradientEnd} 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
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
      from: `${brandName} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
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
  <div style="background: linear-gradient(135deg, ${EMAIL_COLORS.gradientStart} 0%, ${EMAIL_COLORS.gradientEnd} 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
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
</body>
</html>
      `,
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
      from: `${brandName} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
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
  <div style="background: linear-gradient(135deg, ${EMAIL_COLORS.gradientStart} 0%, ${EMAIL_COLORS.gradientEnd} 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
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
      <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/en/chat" style="display: inline-block; background: ${EMAIL_COLORS.ctaButton}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">${useCreditsText}</a>
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
</body>
</html>
      `,
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
