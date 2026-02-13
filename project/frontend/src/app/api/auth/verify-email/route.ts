import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json()

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 })
    }

    // Create a Supabase client with the access token to verify the user
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    )

    // Get the user associated with this access token
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)

    if (userError || !user) {
      console.error('Error getting user:', userError)
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    // Check if email is already verified
    if (user.email_confirmed_at) {
      // Update users table to mark email as verified
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ email_verified: true })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating user:', updateError)
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          email_verified: true,
        },
      })
    }

    // If not confirmed, return error
    return NextResponse.json(
      { error: 'Email not confirmed yet' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
