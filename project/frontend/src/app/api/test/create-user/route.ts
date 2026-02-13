import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/test/create-user - Create a test user (dev only)
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const testEmail = 'profiletest@example.com';
    const testPassword = 'testpass123456';
    const testName = 'Profile Test User';

    // Create user in Supabase Auth using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: testName,
      },
    });

    if (authError) {
      // Check if user already exists
      if (authError.message.includes('already registered')) {
        // User exists, check if in users table
        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', testEmail)
          .single();

        if (dbUser) {
          return NextResponse.json({
            message: 'Test user already exists',
            email: testEmail,
            password: testPassword,
          });
        }

        // Create in users table only
        const { error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            email: testEmail,
            name: testName,
            locale: 'en',
            currency: 'USD',
            email_verified: true,
            notification_preferences: {
              email: true,
              push: false,
              sms: false,
            },
          });

        if (insertError) {
          console.error('Error creating user in database:', insertError);
          return NextResponse.json({ error: 'Failed to create user in database' }, { status: 500 });
        }

        return NextResponse.json({
          message: 'Test user created in database',
          email: testEmail,
          password: testPassword,
        });
      }

      console.error('Error creating auth user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Create user in users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        email: testEmail,
        name: testName,
        locale: 'en',
        currency: 'USD',
        email_verified: true,
        notification_preferences: {
          email: true,
          push: false,
          sms: false,
        },
      });

    if (dbError) {
      console.error('Error creating user in database:', dbError);
      return NextResponse.json({ error: 'Failed to create user in database' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Test user created successfully',
      email: testEmail,
      password: testPassword,
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
