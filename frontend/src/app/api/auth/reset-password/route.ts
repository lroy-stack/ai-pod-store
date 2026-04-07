import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authLimiter, getClientIP } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts / 15 min per IP
    const ip = getClientIP(request)
    const { success } = authLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { password, accessToken } = await request.json()

    if (!password || !accessToken) {
      return NextResponse.json(
        { error: 'Password and access token are required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Create a Supabase client authenticated with the user's access token
    // This ensures only the token holder can reset their own password
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      }
    )

    // Verify the token is valid by getting the user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new reset link.' },
        { status: 401 }
      )
    }

    // Update password using the authenticated session (respects Supabase Auth policies)
    const { data, error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error('Password reset error:', error)
      return NextResponse.json({ error: 'Failed to reset password. Link may be expired.' }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Password reset successfully',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
