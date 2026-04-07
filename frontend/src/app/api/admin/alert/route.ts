/**
 * POST /api/admin/alert
 *
 * Internal admin alert endpoint.
 * Sends alerts via Telegram (if configured) or logs to Supabase admin_alerts table.
 * Rate-limited: max 1 alert of the same type per 5 minutes to prevent flood.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'
import { BRAND } from '@/lib/store-config'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// In-memory dedup: track last alert time per type
const alertDedup = new Map<string, number>()
const DEDUP_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (error) {
    return authErrorResponse(error)
  }

  try {
    const { type, message, severity } = await req.json()

    if (!type || !message) {
      return NextResponse.json({ error: 'type and message required' }, { status: 400 })
    }

    // Dedup check
    const lastSent = alertDedup.get(type) || 0
    if (Date.now() - lastSent < DEDUP_WINDOW_MS) {
      return NextResponse.json({ skipped: true, reason: 'dedup' })
    }
    alertDedup.set(type, Date.now())

    // Clean old dedup entries periodically
    if (alertDedup.size > 100) {
      const now = Date.now()
      for (const [k, v] of alertDedup) {
        if (now - v > DEDUP_WINDOW_MS) alertDedup.delete(k)
      }
    }

    // Try Telegram if configured
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN
    const adminChatId = process.env.PODCLAW_ADMIN_TELEGRAM_CHAT_ID

    if (telegramToken && adminChatId) {
      const emoji = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️'
      const text = `${emoji} *${BRAND.name} Alert*\n\n*Type:* ${type}\n*Severity:* ${severity || 'info'}\n*Message:* ${message}`

      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminChatId,
          text,
          parse_mode: 'Markdown',
        }),
      }).catch((err) => console.error('[Alert] Telegram send failed:', err))
    }

    // Log to notifications table for admin users
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        type: 'system_alert',
        title: `Alert: ${type}`,
        body: message,
        data: { alert_type: type, severity: severity || 'info' },
        is_read: false,
      }))

      // Silently ignore notification insert errors (alert is already logged)
      await supabase.from('notifications').insert(notifications)
    }

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('[Alert] Error:', error)
    return NextResponse.json({ error: 'Failed to send alert' }, { status: 500 })
  }
}
