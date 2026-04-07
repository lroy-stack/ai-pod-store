/**
 * GET /api/newsletter/confirm/[token]
 *
 * Email confirmation endpoint for double opt-in newsletter.
 * Sets confirmed_at timestamp and redirects to success page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BASE_URL } from '@/lib/store-config'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 400 }
      )
    }

    // Find subscriber by confirmation token
    const { data: subscriber, error: fetchError } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, confirmed_at, locale')
      .eq('confirmation_token', token)
      .single()

    if (fetchError || !subscriber) {
      return NextResponse.json(
        { error: 'Invalid or expired confirmation token' },
        { status: 404 }
      )
    }

    // Already confirmed - just return success
    if (subscriber.confirmed_at) {
      const locale = subscriber.locale || 'en'
      return NextResponse.redirect(
        `${BASE_URL}/${locale}?newsletter=confirmed`
      )
    }

    // Confirm subscription by setting confirmed_at and clearing token
    const { error: updateError } = await supabase
      .from('newsletter_subscribers')
      .update({
        confirmed_at: new Date().toISOString(),
        confirmation_token: null, // Clear token after successful confirmation
      })
      .eq('id', subscriber.id)

    if (updateError) {
      console.error('[Newsletter] Confirmation update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to confirm subscription' },
        { status: 500 }
      )
    }

    // Redirect to success page (use subscriber locale)
    const locale = subscriber.locale || 'en'
    return NextResponse.redirect(
      `${BASE_URL}/${locale}?newsletter=confirmed`
    )
  } catch (error) {
    console.error('[Newsletter] Confirm error:', error)
    return NextResponse.json(
      { error: 'Confirmation failed' },
      { status: 500 }
    )
  }
}
