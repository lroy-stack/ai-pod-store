/**
 * Push Notification Utilities (Server-side)
 *
 * Helper functions for sending Web Push notifications.
 * Used by API routes and server-side code.
 */

import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { CONTACT } from '@/lib/store-config'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Configure VAPID keys
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || CONTACT.push

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

/**
 * Send push notification to a specific user.
 * Exported for use by other server-side code (webhooks, etc.)
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string; actions?: Array<{ action: string; title: string }> }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[Push] VAPID keys not configured — skipping push notification')
    return { sent: 0, failed: 0 }
  }

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
      sent++
    } catch (error: any) {
      failed++
      // Remove expired/invalid subscriptions (410 Gone or 404)
      if (error.statusCode === 410 || error.statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
      }
    }
  }

  return { sent, failed }
}
