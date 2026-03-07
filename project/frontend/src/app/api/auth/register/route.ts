import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { registerLimiter } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { BASE_URL } from '@/lib/store-config'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const { success } = registerLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const { name, email, password, turnstileToken } = body

    // Verify Turnstile token (gracefully skips if TURNSTILE_SECRET_KEY not configured)
    const turnstileValid = await verifyTurnstileToken(turnstileToken, ip)
    if (!turnstileValid) {
      return NextResponse.json(
        { error: 'CAPTCHA verification failed. Please try again.' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password' },
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

    // Validate password strength (min 8 chars, 1 uppercase, 1 number)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter and one number' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth and send confirmation email
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: (() => {
          const referer = request.headers.get('referer') || ''
          const localeMatch = referer.match(/\/(en|es|de)\//)
          const locale = localeMatch?.[1] || 'en'
          return `${BASE_URL}/${locale}/auth/verify-email`
        })(),
      },
    })

    if (authError) {
      console.error('Supabase auth error:', authError)
      return NextResponse.json(
        { error: authError.message || 'Failed to create user account' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      )
    }

    // Insert user profile into users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        name,
        locale: 'en', // Default locale, can be updated later
        currency: 'EUR', // Default currency for European store
        email_verified: false, // Will be set to true after email verification
        notification_preferences: {
          email: true,
          push: false,
          sms: false,
        },
      })
      .select()
      .single()

    if (userError) {
      console.error('Database error:', userError)
      // User was created in auth but not in users table
      // In production, this should trigger a cleanup job
      return NextResponse.json(
        { error: 'User account created but profile failed to save' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
