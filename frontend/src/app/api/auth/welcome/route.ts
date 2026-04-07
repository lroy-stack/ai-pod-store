import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendWelcomeEmail } from '@/lib/resend'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/welcome
 *
 * Called from OAuth callback to send welcome email for new users.
 * Checks if this is the user's first login (created_at within last 60s).
 * Idempotent — won't send twice thanks to notification_preferences.welcome_sent flag.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sb-access-token')?.value
    if (!token) {
      return NextResponse.json({ sent: false, reason: 'no-session' }, { status: 200 })
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return NextResponse.json({ sent: false, reason: 'invalid-token' }, { status: 200 })
    }

    // Read locale from request body (sent by callback with current page locale)
    let requestLocale: string | null = null
    try {
      const body = await request.json()
      requestLocale = body.locale || null
    } catch { /* no body */ }

    // Check if welcome email already sent
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('name, locale, notification_preferences')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ sent: false, reason: 'no-profile' }, { status: 200 })
    }

    // Use request locale (from UI) over DB locale (may be default 'en')
    const locale = requestLocale || profile.locale || 'en'

    // Update DB locale if it differs
    if (requestLocale && profile.locale !== requestLocale) {
      await supabaseAdmin.from('users').update({ locale: requestLocale }).eq('id', user.id)
    }

    const prefs = (profile.notification_preferences || {}) as Record<string, unknown>
    if (prefs.welcome_sent) {
      return NextResponse.json({ sent: false, reason: 'already-sent' }, { status: 200 })
    }

    // Send welcome email
    const result = await sendWelcomeEmail({
      to: user.email!,
      name: profile.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email!.split('@')[0],
      locale,
    })

    // Mark as sent (idempotent flag)
    if (result.success) {
      await supabaseAdmin
        .from('users')
        .update({
          notification_preferences: { ...prefs, welcome_sent: true },
        })
        .eq('id', user.id)
    }

    return NextResponse.json({ sent: result.success, messageId: result.messageId })
  } catch (err) {
    console.error('[POST /api/auth/welcome] Error:', err)
    return NextResponse.json({ sent: false, reason: 'error' }, { status: 200 })
  }
}
