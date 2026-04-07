/**
 * Push Subscription API
 *
 * POST /api/push/subscribe
 * Stores a Web Push subscription for the authenticated user.
 */

import { NextRequest } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const { endpoint, keys } = body
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json(
        { error: 'endpoint, keys.p256dh, and keys.auth are required' },
        { status: 400 }
      )
    }

    // Upsert subscription (endpoint is unique)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: req.headers.get('user-agent')?.substring(0, 500) || null,
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('Push subscribe error:', error)
      return Response.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    return authErrorResponse(error)
  }
}
