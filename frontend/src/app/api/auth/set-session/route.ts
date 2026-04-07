import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/auth/set-session
 *
 * Sets HTTP-only cookies for the Supabase session tokens.
 * Called by the OAuth callback page after successful authentication.
 * This bridges the gap between client-side Supabase auth (localStorage)
 * and server-side session verification (cookies).
 */
export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token, expires_in } = await request.json()

    if (!access_token) {
      return NextResponse.json({ error: 'Missing access_token' }, { status: 400 })
    }

    const response = NextResponse.json({ success: true })

    response.cookies.set({
      name: 'sb-access-token',
      value: access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expires_in || 3600,
      path: '/',
    })

    if (refresh_token) {
      response.cookies.set({
        name: 'sb-refresh-token',
        value: refresh_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })
    }

    return response
  } catch (error) {
    console.error('Set session error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
