/**
 * Admin Settings API
 *
 * GET  /api/admin/settings - Returns admin settings
 * PUT  /api/admin/settings - Updates admin settings (admin only)
 */

import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { STORE_NAME, STORE_CONTACT_EMAIL, STORE_SUPPORT_EMAIL } from '@/lib/store-defaults';

/**
 * GET /api/admin/settings
 * Returns the admin settings from the database
 */
export async function GET(request: NextRequest) {
  try {
    // Validate encrypted session using iron-session
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    // Check if user is logged in
    if (!session.isLoggedIn || !session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createClient();

    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      // If no settings exist yet, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          id: 1,
          settings: {
            store_name: STORE_NAME,
            store_description: 'AI-powered fashion & accessories, designed with you, made in Europe',
            contact_email: STORE_CONTACT_EMAIL,
            support_email: STORE_SUPPORT_EMAIL,
            currency: 'EUR',
            timezone: 'UTC',
          },
          updated_at: new Date().toISOString(),
        });
      }

      console.error('Error fetching admin settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch admin settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error in admin settings GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings
 * Updates the admin settings
 * Requires admin authentication
 */
export async function PUT(request: NextRequest) {
  try {
    // Validate encrypted session using iron-session
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    // Check if user is logged in
    if (!session.isLoggedIn || !session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminId = session.id;

    // Parse request body
    const body = await request.json();
    const { settings } = body;

    // Validate settings object
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = [
      'store_name',
      'store_description',
      'contact_email',
      'support_email',
    ];

    for (const field of requiredFields) {
      if (!settings[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(settings.contact_email)) {
      return NextResponse.json(
        { error: 'Invalid contact_email format' },
        { status: 400 }
      );
    }
    if (!emailRegex.test(settings.support_email)) {
      return NextResponse.json(
        { error: 'Invalid support_email format' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get existing settings to track changes for audit log
    const { data: existingSettings } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('id', 1)
      .single();

    // Update or insert settings
    let updatedSettings;
    if (existingSettings) {
      const { data, error: updateError } = await supabase
        .from('admin_settings')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating admin settings:', updateError);
        return NextResponse.json(
          { error: 'Failed to update admin settings' },
          { status: 500 }
        );
      }
      updatedSettings = data;
    } else {
      // Insert new settings if none exist
      const { data, error: insertError } = await supabase
        .from('admin_settings')
        .insert({ id: 1, settings })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting admin settings:', insertError);
        return NextResponse.json(
          { error: 'Failed to create admin settings' },
          { status: 500 }
        );
      }
      updatedSettings = data;
    }

    // Create audit log entry
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        actor_type: 'admin',
        actor_id: adminId,
        action: 'update',
        resource_type: 'admin_settings',
        resource_id: '1',
        changes: {
          old_settings: existingSettings?.settings || null,
          new_settings: settings,
        },
      });

    if (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail the request, but log the error
    }

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('Error in admin settings PUT API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
