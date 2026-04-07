/**
 * POST /api/profile/change-email
 * Request email change. Supabase sends a confirmation link to the new email.
 * Requires current password for security.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { changeEmailLimiter } from '@/lib/rate-limit'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  try {
    // Get session from cookies
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value
    const refreshToken = cookieStore.get('sb-refresh-token')?.value

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create Supabase client with session (same pattern as change-password)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    const { data: { user }, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    if (sessionError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Rate limit
    const { success } = changeEmailLimiter.check(`email:${user.id}`)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // Parse body
    const body = await request.json()
    const { newEmail, password } = body

    if (!newEmail || !password) {
      return NextResponse.json(
        { error: 'New email and password are required' },
        { status: 400 }
      )
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (newEmail.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'New email must be different' }, { status: 400 })
    }

    // Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    })

    if (verifyError) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 400 })
    }

    // Request email change — Supabase sends confirmation to new email
    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail,
    })

    if (updateError) {
      console.error('[change-email] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to change email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[change-email] Error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
