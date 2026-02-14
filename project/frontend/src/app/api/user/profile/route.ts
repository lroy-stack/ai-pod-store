import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/user/profile - Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from HTTP-only cookie
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile from users table
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, avatar_url, locale, currency, phone, email_verified, notification_preferences')
      .eq('email', user.email)
      .single();

    // If no profile row exists, create one automatically from auth user data
    if (profileError && profileError.code === 'PGRST116') {
      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          locale: 'en',
          currency: 'EUR',
          email_verified: !!user.email_confirmed_at,
          notification_preferences: { email: true, push: true, sms: false },
        })
        .select('id, email, name, avatar_url, locale, currency, phone, email_verified, notification_preferences')
        .single();

      if (insertError) {
        console.error('[GET /api/user/profile] Error creating profile:', insertError);
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
      }
      profile = newProfile;
    } else if (profileError) {
      console.error('[GET /api/user/profile] Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[GET /api/user/profile] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/profile - Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    // Get token from HTTP-only cookie
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, locale, currency, avatar_url, notification_preferences } = body;

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (locale !== undefined) updates.locale = locale;
    if (currency !== undefined) updates.currency = currency;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (notification_preferences !== undefined) updates.notification_preferences = notification_preferences;

    // Update user profile
    const { data: profile, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('email', user.email)
      .select('id, email, name, avatar_url, locale, currency, phone, email_verified, notification_preferences')
      .single();

    if (updateError) {
      console.error('[PATCH /api/user/profile] Error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[PATCH /api/user/profile] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
