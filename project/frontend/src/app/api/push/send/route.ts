/**
 * Push Send API (Internal)
 *
 * POST /api/push/send
 * Sends a Web Push notification to a user. Requires admin or system auth.
 */

import { NextRequest } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Configure VAPID keys
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:push@podai.com'

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

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)

    const body = await req.json()
    const { user_id, title, body: notifBody, url, tag } = body

    if (!user_id || !title || !notifBody) {
      return Response.json(
        { error: 'user_id, title, and body are required' },
        { status: 400 }
      )
    }

    const result = await sendPushToUser(user_id, {
      title,
      body: notifBody,
      url,
      tag,
    })

    return Response.json({ success: true, ...result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
