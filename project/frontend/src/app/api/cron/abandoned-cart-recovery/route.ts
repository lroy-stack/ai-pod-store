/**
 * GET /api/cron/abandoned-cart-recovery
 *
 * Cron-triggered abandoned cart email processor.
 * Finds carts abandoned for >1h (first email) or >24h (second email) and sends recovery emails.
 *
 * Should be called every 30-60 minutes via Vercel Cron or external cron.
 * Protected by Bearer token authentication.
 *
 * Note: Only works for authenticated users (guest carts have no email).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCronSecret } from '@/lib/rate-limit'
import { BASE_URL, BRAND, CONTACT } from '@/lib/store-config'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CRON_SECRET = process.env.CRON_SECRET

// Email color palette
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
}

async function sendAbandonedCartEmail(params: {
  to: string
  locale: string
  cartItemCount: number
  isSecondEmail: boolean
}) {
  const { to, locale, cartItemCount, isSecondEmail } = params

  // Locale-aware email content
  const subjects = {
    en: isSecondEmail
      ? `Your cart is still waiting! 🛒`
      : `You left ${cartItemCount} ${cartItemCount === 1 ? 'item' : 'items'} in your cart`,
    es: isSecondEmail
      ? `¡Tu carrito sigue esperando! 🛒`
      : `Dejaste ${cartItemCount} ${cartItemCount === 1 ? 'artículo' : 'artículos'} en tu carrito`,
    de: isSecondEmail
      ? `Dein Warenkorb wartet noch! 🛒`
      : `Du hast ${cartItemCount} ${cartItemCount === 1 ? 'Artikel' : 'Artikel'} im Warenkorb gelassen`,
  }

  const headings = {
    en: isSecondEmail
      ? "Don't miss out! 🎨"
      : 'Did you forget something? 🛍️',
    es: isSecondEmail
      ? '¡No te lo pierdas! 🎨'
      : '¿Olvidaste algo? 🛍️',
    de: isSecondEmail
      ? 'Verpasse es nicht! 🎨'
      : 'Hast du etwas vergessen? 🛍️',
  }

  const bodies = {
    en: isSecondEmail
      ? `Your cart with ${cartItemCount} ${cartItemCount === 1 ? 'item' : 'items'} is still waiting for you. Complete your order now and bring your designs to life!`
      : `You have ${cartItemCount} ${cartItemCount === 1 ? 'item' : 'items'} in your cart. Complete your order before ${cartItemCount === 1 ? 'it\'s' : 'they\'re'} gone!`,
    es: isSecondEmail
      ? `Tu carrito con ${cartItemCount} ${cartItemCount === 1 ? 'artículo' : 'artículos'} todavía te está esperando. ¡Completa tu pedido ahora y dale vida a tus diseños!`
      : `Tienes ${cartItemCount} ${cartItemCount === 1 ? 'artículo' : 'artículos'} en tu carrito. ¡Completa tu pedido antes de que ${cartItemCount === 1 ? 'desaparezca' : 'desaparezcan'}!`,
    de: isSecondEmail
      ? `Dein Warenkorb mit ${cartItemCount} ${cartItemCount === 1 ? 'Artikel' : 'Artikeln'} wartet noch auf dich. Schließe deine Bestellung jetzt ab und erwecke deine Designs zum Leben!`
      : `Du hast ${cartItemCount} ${cartItemCount === 1 ? 'Artikel' : 'Artikel'} in deinem Warenkorb. Schließe deine Bestellung ab, bevor ${cartItemCount === 1 ? 'er' : 'sie'} weg ${cartItemCount === 1 ? 'ist' : 'sind'}!`,
  }

  const ctaTexts = {
    en: 'Complete Your Order',
    es: 'Completa tu Pedido',
    de: 'Bestellung Abschließen',
  }

  const subject = subjects[locale as keyof typeof subjects] || subjects.en
  const heading = headings[locale as keyof typeof headings] || headings.en
  const body = bodies[locale as keyof typeof bodies] || bodies.en
  const ctaText = ctaTexts[locale as keyof typeof ctaTexts] || ctaTexts.en

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[Abandoned Cart] RESEND_API_KEY not configured')
    return { success: false, error: 'Resend not configured' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || `${BRAND.name} <${CONTACT.general}>`,
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
    <h1 style="margin: 0; font-size: 28px;">${BRAND.name}</h1>
  </div>

  <div style="background: ${EMAIL_COLORS.panelBg}; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: ${EMAIL_COLORS.heading}; margin-top: 0;">${heading}</h2>

    <p style="font-size: 16px; margin: 20px 0;">${body}</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${BASE_URL}/${locale}/cart" style="display: inline-block; background: ${EMAIL_COLORS.ctaButton}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">${ctaText}</a>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_COLORS.mutedText}; margin-top: 30px;">
      ${locale === 'es' ? `Gracias por elegir ${BRAND.name}` : locale === 'de' ? `Danke, dass du ${BRAND.name} gewählt hast` : `Thank you for choosing ${BRAND.name}`}!
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: ${EMAIL_COLORS.footerText};">
    <p>${BRAND.name} ${locale === 'es' ? '— Tu tienda de impresión bajo demanda impulsada por IA' : locale === 'de' ? '— Dein KI-gesteuerter Print-on-Demand-Marktplatz' : '— AI-Powered Print on Demand'}</p>
  </div>
</body>
</html>
        `,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Abandoned Cart] Resend error:', errorText)
      return { success: false, error: errorText }
    }

    const data = await res.json()
    return { success: true, messageId: data.id }
  } catch (error) {
    console.error('[Abandoned Cart] Send error:', error)
    return { success: false, error }
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret (timing-safe)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Find abandoned carts (authenticated users only with items in cart)
    // Group by user_id to get the most recent cart update time
    const { data: abandonedCarts, error: fetchError } = await supabase.rpc(
      'get_abandoned_carts',
      {
        one_hour_ago_ts: oneHourAgo.toISOString(),
      }
    )

    if (fetchError) {
      console.error('[Abandoned Cart] Fetch error:', fetchError)

      // Fallback: manual query if RPC doesn't exist
      const { data: cartItems, error: cartError } = await supabase
        .from('cart_items')
        .select('user_id, updated_at')
        .not('user_id', 'is', null)
        .lt('updated_at', oneHourAgo.toISOString())
        .order('updated_at', { ascending: true })

      if (cartError) {
        console.error('[Abandoned Cart] Cart query error:', cartError)
        return NextResponse.json({ error: 'Failed to fetch carts' }, { status: 500 })
      }

      // Manual grouping by user_id
      const userCartMap = new Map<string, { updated_at: string; count: number }>()
      for (const item of cartItems || []) {
        if (!item.user_id) continue
        const existing = userCartMap.get(item.user_id)
        if (!existing || existing.updated_at < item.updated_at) {
          const count = cartItems.filter(i => i.user_id === item.user_id).length
          userCartMap.set(item.user_id, {
            updated_at: item.updated_at,
            count,
          })
        }
      }

      const manualCarts = Array.from(userCartMap.entries()).map(([user_id, data]) => ({
        user_id,
        cart_last_updated: data.updated_at,
        item_count: data.count,
      }))

      return processAbandonedCarts(manualCarts, oneHourAgo, twentyFourHoursAgo)
    }

    return processAbandonedCarts(abandonedCarts || [], oneHourAgo, twentyFourHoursAgo)
  } catch (error) {
    console.error('[Abandoned Cart] Cron error:', error)
    return NextResponse.json({ error: 'Recovery processing failed' }, { status: 500 })
  }
}

async function processAbandonedCarts(
  carts: Array<{ user_id: string; cart_last_updated: string; item_count: number }>,
  oneHourAgo: Date,
  twentyFourHoursAgo: Date
) {
  if (!carts || carts.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let firstEmailsSent = 0
  let secondEmailsSent = 0
  let failed = 0

  for (const cart of carts) {
    try {
      const cartLastUpdated = new Date(cart.cart_last_updated)

      // Check if user has completed an order since cart was last updated
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', cart.user_id)
        .gte('created_at', cart.cart_last_updated)
        .eq('status', 'completed')
        .limit(1)

      if (orders && orders.length > 0) {
        // User has completed an order - mark cart as recovered if tracked
        await supabase
          .from('abandoned_carts')
          .update({ recovered_at: new Date().toISOString() })
          .eq('user_id', cart.user_id)
          .is('recovered_at', null)
        continue
      }

      // Get user email and locale
      const { data: user } = await supabase
        .from('users')
        .select('email, locale')
        .eq('id', cart.user_id)
        .single()

      if (!user || !user.email) {
        console.warn(`[Abandoned Cart] User ${cart.user_id} has no email`)
        failed++
        continue
      }

      // Check if we're already tracking this abandoned cart
      let { data: tracking } = await supabase
        .from('abandoned_carts')
        .select('*')
        .eq('user_id', cart.user_id)
        .is('recovered_at', null)
        .single()

      const shouldSendFirstEmail =
        cartLastUpdated <= oneHourAgo && (!tracking || !tracking.first_email_sent_at)

      const shouldSendSecondEmail =
        cartLastUpdated <= twentyFourHoursAgo &&
        tracking &&
        tracking.first_email_sent_at &&
        !tracking.second_email_sent_at

      if (shouldSendFirstEmail) {
        // Send first recovery email
        const result = await sendAbandonedCartEmail({
          to: user.email,
          locale: user.locale || 'en',
          cartItemCount: cart.item_count || 1,
          isSecondEmail: false,
        })

        if (result.success) {
          if (!tracking) {
            // Create tracking entry
            await supabase.from('abandoned_carts').insert({
              user_id: cart.user_id,
              email: user.email,
              locale: user.locale || 'en',
              first_email_sent_at: new Date().toISOString(),
              cart_last_updated_at: cart.cart_last_updated,
            })
          } else {
            // Update tracking entry
            await supabase
              .from('abandoned_carts')
              .update({
                first_email_sent_at: new Date().toISOString(),
                cart_last_updated_at: cart.cart_last_updated,
              })
              .eq('id', tracking.id)
          }
          firstEmailsSent++
        } else {
          failed++
        }
      } else if (shouldSendSecondEmail) {
        // Send second recovery email
        const result = await sendAbandonedCartEmail({
          to: user.email,
          locale: user.locale || 'en',
          cartItemCount: cart.item_count || 1,
          isSecondEmail: true,
        })

        if (result.success) {
          await supabase
            .from('abandoned_carts')
            .update({ second_email_sent_at: new Date().toISOString() })
            .eq('id', tracking!.id)
          secondEmailsSent++
        } else {
          failed++
        }
      }
    } catch (err) {
      console.error(`[Abandoned Cart] Error processing cart for user ${cart.user_id}:`, err)
      failed++
    }
  }

  return NextResponse.json({
    processed: carts.length,
    firstEmailsSent,
    secondEmailsSent,
    failed,
  })
}
