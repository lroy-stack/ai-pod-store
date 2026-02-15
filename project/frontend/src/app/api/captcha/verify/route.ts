/**
 * POST /api/captcha/verify
 *
 * Verifies an hCaptcha token server-side.
 * On success, sets a pod-captcha-verified cookie (24h TTL).
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const secret = process.env.HCAPTCHA_SECRET_KEY
    if (!secret) {
      // In dev without hCaptcha configured, accept any token
      if (process.env.NODE_ENV === 'development') {
        const res = NextResponse.json({ verified: true })
        res.cookies.set('pod-captcha-verified', '1', {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 24 * 60 * 60, // 24 hours
        })
        return res
      }
      return NextResponse.json({ error: 'CAPTCHA not configured' }, { status: 500 })
    }

    // Verify with hCaptcha API
    const verifyRes = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
      }),
    })

    const data = await verifyRes.json()

    if (!data.success) {
      return NextResponse.json(
        { error: 'CAPTCHA verification failed', codes: data['error-codes'] },
        { status: 403 }
      )
    }

    // Set verified cookie
    const res = NextResponse.json({ verified: true })
    res.cookies.set('pod-captcha-verified', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
    })

    return res
  } catch (error) {
    console.error('[CAPTCHA] Verification error:', error)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
