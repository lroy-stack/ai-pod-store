import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  try {
    // Get access token from cookies
    const accessToken = request.cookies.get('sb-access-token')?.value

    if (accessToken) {
      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      })

      // Sign out from Supabase Auth
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('Supabase sign out error:', error)
        // Continue even if sign out fails on the server side
      }
    }

    // Create response
    const response = NextResponse.json(
      {
        success: true,
        message: 'Logged out successfully',
      },
      { status: 200 }
    )

    // Clear ALL client-side storage (localStorage, sessionStorage, cookies, cache)
    // This prevents data leakage on shared devices
    response.headers.set('Clear-Site-Data', '"storage"')

    // Clear session cookies
    response.cookies.set({
      name: 'sb-access-token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    response.cookies.set({
      name: 'sb-refresh-token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Logout error:', error)

    // Even if there's an error, clear cookies on the client side
    const response = NextResponse.json(
      {
        success: true,
        message: 'Logged out',
      },
      { status: 200 }
    )

    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')

    return response
  }
}
