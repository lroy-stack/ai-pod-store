import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { forgotPasswordLimiter } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { BASE_URL } from '@/lib/store-config'

// Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const { success } = forgotPasswordLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { email, turnstileToken } = await request.json()

    // Verify Turnstile token (gracefully skips if TURNSTILE_SECRET_KEY not configured)
    const turnstileValid = await verifyTurnstileToken(turnstileToken, ip)
    if (!turnstileValid) {
      return NextResponse.json(
        { error: 'CAPTCHA verification failed. Please try again.' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Extract locale from referer header
    const referer = request.headers.get('referer') || ''
    const localeMatch = referer.match(/\/(en|es|de)\//)
    const locale = localeMatch?.[1] || 'en'

    // Send password reset email using Supabase Auth
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${BASE_URL}/${locale}/auth/reset-password`,
    })

    if (error) {
      console.error('Password reset error:', error)
      // Don't reveal if email exists or not for security
      // Always return success to prevent email enumeration
    }

    // Always return success (even if email doesn't exist)
    // This prevents attackers from discovering valid email addresses
    return NextResponse.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
