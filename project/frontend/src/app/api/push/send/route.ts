/**
 * Push Send API (Internal)
 *
 * POST /api/push/send
 * Sends a Web Push notification to a user. Requires admin or system auth.
 */

import { NextRequest } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'
import { sendPushToUser } from '@/lib/push-notifications'

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
