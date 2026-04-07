import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authLimiter } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const { success } = authLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const { email, password, turnstileToken } = body

    // Verify Turnstile token (gracefully skips if TURNSTILE_SECRET_KEY not configured)
    const turnstileValid = await verifyTurnstileToken(turnstileToken, ip)
    if (!turnstileValid) {
      return NextResponse.json(
        { error: 'CAPTCHA verification failed. Please try again.' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.error('Supabase auth error:', authError)

      // Check if error is due to invalid credentials
      if (authError.message.includes('Invalid login credentials')) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: authError.message || 'Login failed' },
        { status: 400 }
      )
    }

    if (!authData.user || !authData.session) {
      return NextResponse.json(
        { error: 'Login failed' },
        { status: 500 }
      )
    }

    // Fetch user's locale and deletion status from database
    const { data: userData } = await supabase
      .from('users')
      .select('locale, deletion_requested_at')
      .eq('id', authData.user.id)
      .single()

    const userLocale = userData?.locale || 'en'

    // Note: deletion is NOT auto-cancelled on login.
    // The user must explicitly cancel via /api/profile/cancel-deletion.

    // Create response — tokens only in httpOnly cookies, NOT in body
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: authData.user.user_metadata?.name,
          locale: userLocale,
          deletion_requested_at: userData?.deletion_requested_at || null,
        },
        expires_at: authData.session.expires_at,
      },
      { status: 200 }
    )

    // Set HTTP-only session cookie
    response.cookies.set({
      name: 'sb-access-token',
      value: authData.session.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: authData.session.expires_in || 3600,
      path: '/',
    })

    response.cookies.set({
      name: 'sb-refresh-token',
      value: authData.session.refresh_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
