import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAuth, getAccessToken, authErrorResponse } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/user/profile - Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Get user profile from users table (with optional tenant isolation)
    const tenantId = request.headers.get('x-tenant-id');
    let profileQuery = supabaseAdmin
      .from('users')
      .select('id, email, name, avatar_url, locale, currency, phone, email_verified, notification_preferences, deletion_requested_at')
      .eq('id', user.id);

    if (tenantId) {
      profileQuery = profileQuery.eq('tenant_id', tenantId);
    }

    let { data: profile, error: profileError } = await profileQuery.single();

    // If no profile row exists, create one automatically from auth user data
    if (profileError && profileError.code === 'PGRST116') {
      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          name: user.email?.split('@')[0] || '',
          locale: (() => {
            const referer = request.headers.get('referer') || ''
            const pathMatch = referer.match(/\/(en|es|de)\//)
            if (pathMatch) return pathMatch[1]
            const acceptLang = request.headers.get('accept-language')?.split(',')[0]?.split('-')[0] || 'en'
            return ['en', 'es', 'de'].includes(acceptLang) ? acceptLang : 'en'
          })(),
          currency: 'EUR',
          email_verified: false,
          notification_preferences: { email: true, push: true, sms: false },
        })
        .select('id, email, name, avatar_url, locale, currency, phone, email_verified, notification_preferences, deletion_requested_at')
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

    // Fetch auth identities (Google/Apple/Email providers)
    let providers: Array<{ provider: string; email: string | null; created_at: string }> = []
    let hasPassword = false
    const token = getAccessToken(request)
    if (token) {
      try {
        const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(token)
        if (authUser?.identities) {
          providers = authUser.identities.map(i => ({
            provider: i.provider,
            email: (i.identity_data as Record<string, unknown>)?.email as string || null,
            created_at: i.created_at || '',
          }))
          hasPassword = authUser.identities.some(i => i.provider === 'email')
        }
      } catch {
        // Non-fatal — profile still works without identity info
      }
    }

    return NextResponse.json({ profile, providers, has_password: hasPassword });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error);
    console.error('[GET /api/user/profile] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/profile - Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);

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

    const { data: profile, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select('id, email, name, avatar_url, locale, currency, phone, email_verified, notification_preferences, deletion_requested_at')
      .single();

    if (updateError) {
      console.error('[PATCH /api/user/profile] Error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error);
    console.error('[PATCH /api/user/profile] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
