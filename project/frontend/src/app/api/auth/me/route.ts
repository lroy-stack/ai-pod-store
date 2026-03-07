import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    // Get user from session token
    const token = request.cookies.get('sb-access-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user profile from users table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, phone, avatar_url, locale, currency, notification_preferences, preferences, email_verified, created_at, tier, credit_balance, subscription_status')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({
      user: profile
    })
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
