import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export async function GET(request: NextRequest) {
  try {
    // Get access token from HTTP-only cookie
    const accessToken = request.cookies.get('sb-access-token')?.value
    const refreshToken = request.cookies.get('sb-refresh-token')?.value

    if (!accessToken) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 200 }
      )
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify the access token by getting the user
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user) {
      // Token is invalid or expired, try to refresh
      if (refreshToken) {
        const supabaseClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
          },
        })

        const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession({
          refresh_token: refreshToken,
        })

        if (refreshError || !refreshData.session) {
          // Clear invalid cookies
          const response = NextResponse.json(
            { authenticated: false, user: null },
            { status: 200 }
          )
          response.cookies.delete('sb-access-token')
          response.cookies.delete('sb-refresh-token')
          return response
        }

        // Fetch user profile from users table
        const refreshedUser = refreshData.user!
        const { data: profile } = await supabase
          .from('users')
          .select('locale, currency, email, avatar_url, deletion_requested_at')
          .eq('id', refreshedUser.id)
          .single()

        // Sync email if changed
        if (profile && profile.email !== refreshedUser.email) {
          await supabase
            .from('users')
            .update({ email: refreshedUser.email })
            .eq('id', refreshedUser.id)
        }

        // Update cookies with new tokens
        const response = NextResponse.json(
          {
            authenticated: true,
            user: {
              id: refreshedUser.id,
              email: refreshedUser.email,
              name: refreshedUser.user_metadata?.name,
              avatar_url: profile?.avatar_url || refreshedUser.user_metadata?.avatar_url || null,
              locale: profile?.locale || 'en',
              currency: profile?.currency || 'EUR',
              deletion_requested_at: profile?.deletion_requested_at || null,
            },
          },
          { status: 200 }
        )

        response.cookies.set({
          name: 'sb-access-token',
          value: refreshData.session.access_token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: refreshData.session.expires_in || 3600,
          path: '/',
        })

        response.cookies.set({
          name: 'sb-refresh-token',
          value: refreshData.session.refresh_token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/',
        })

        return response
      }

      // No refresh token available, clear cookies
      const response = NextResponse.json(
        { authenticated: false, user: null },
        { status: 200 }
      )
      response.cookies.delete('sb-access-token')
      response.cookies.delete('sb-refresh-token')
      return response
    }

    // Token is valid, fetch user profile from users table
    const { data: profile } = await supabase
      .from('users')
      .select('locale, currency, email, avatar_url, deletion_requested_at')
      .eq('id', user.id)
      .single()

    // Sync email if it changed (e.g., after confirming email change via Supabase)
    if (profile && profile.email !== user.email) {
      await supabase
        .from('users')
        .update({ email: user.email })
        .eq('id', user.id)
    }

    // Return user data
    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name,
          avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
          locale: profile?.locale || 'en',
          currency: profile?.currency || 'EUR',
          deletion_requested_at: profile?.deletion_requested_at || null,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
