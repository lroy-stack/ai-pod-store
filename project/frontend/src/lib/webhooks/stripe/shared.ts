/**
 * Shared utilities for Stripe webhook handlers
 */

import { createClient } from '@supabase/supabase-js'
import { BASE_URL, EMAIL_FROM } from '@/lib/store-config'

// Initialize Supabase client with service role key for webhook
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * Notify the customer that their order requires manual review.
 * Uses Resend email service.
 */
export async function sendOrderIssueEmail(email: string, orderId: string, locale: string) {
  try {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return

    const orderNumber = orderId.slice(0, 8)

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject: locale === 'es'
          ? `Pedido #${orderNumber} — Revisión necesaria`
          : locale === 'de'
            ? `Bestellung #${orderNumber} — Überprüfung erforderlich`
            : `Order #${orderNumber} — Review Required`,
        html: locale === 'es'
          ? `<h1>Tu pedido requiere revisión</h1><p>Estamos revisando tu pedido #${orderNumber}. Nuestro equipo te contactará pronto con una actualización.</p><p><a href="${BASE_URL}/es/orders">Ver tus pedidos →</a></p>`
          : locale === 'de'
            ? `<h1>Deine Bestellung wird überprüft</h1><p>Wir überprüfen deine Bestellung #${orderNumber}. Unser Team wird sich bald mit einem Update bei dir melden.</p><p><a href="${BASE_URL}/de/orders">Bestellungen ansehen →</a></p>`
            : `<h1>Your order is under review</h1><p>We're reviewing your order #${orderNumber}. Our team will contact you shortly with an update.</p><p><a href="${BASE_URL}/en/orders">View your orders →</a></p>`,
      }),
    })
    console.log(`Order issue email sent to ${email} for order ${orderNumber}`)
  } catch (err) {
    console.error('Failed to send order issue email:', err)
  }
}

/**
 * Notify admin of POD provider submission failure
 * Creates a notification for all admin users
 */
export async function notifyAdminOfProviderFailure(
  orderId: string,
  failureType: 'submission' | 'production' | 'variant_mapping',
  errorMessage: string
) {
  try {
    // Find all admin users
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')

    if (!admins || admins.length === 0) {
      console.warn('No admin users found - cannot send provider failure notification')
      return
    }

    // Create notification for each admin
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type: 'pod_error',
      title: `Provider ${failureType} failed`,
      body: `Order ${orderId.slice(0, 8)} failed to submit to provider: ${errorMessage}`,
      data: {
        order_id: orderId,
        failure_type: failureType,
        error: errorMessage,
      },
      is_read: false,
    }))

    const { error } = await supabase
      .from('notifications')
      .insert(notifications)

    if (error) {
      console.error('Failed to create admin notifications:', error)
    } else {
      console.log(`Created ${notifications.length} admin notifications for provider failure`)
    }
  } catch (error) {
    console.error('Error notifying admin of provider failure:', error)
  }
}
