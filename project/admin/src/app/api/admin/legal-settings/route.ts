/**
 * Legal Settings API
 *
 * GET  /api/admin/legal-settings - Returns legal settings (public read)
 * PUT  /api/admin/legal-settings - Updates legal settings (admin only)
 */

import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { withAuth } from '@/lib/auth-middleware';
import { STORE_COMPANY_NAME, STORE_COMPANY_ADDRESS, STORE_LEGAL_EMAIL, STORE_PRIVACY_EMAIL } from '@/lib/store-defaults';

/**
 * GET /api/admin/legal-settings
 * Returns the company legal settings from the database
 * Requires admin authentication
 */
export const GET = withAuth(async () => {
  try {
    const supabase = createClient();

    const { data: settings, error } = await supabase
      .from('legal_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If no settings exist yet, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          settings: {
            company_name: STORE_COMPANY_NAME,
            company_address: STORE_COMPANY_ADDRESS,
            tax_id: '',
            company_email: STORE_LEGAL_EMAIL,
            dpo_name: 'Data Protection Officer',
            dpo_email: STORE_PRIVACY_EMAIL,
            privacy_policy_url: '/privacy',
            terms_of_service_url: '/terms',
            cookie_policy_url: '/privacy#cookies',
            // Data retention periods (in days)
            retention_conversations: 365,
            retention_audit_logs: 730,
            retention_marketing_events: 180,
          },
        });
      }

      console.error('Error fetching legal settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch legal settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error in legal-settings GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/legal-settings
 * Updates the company legal settings
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
      'company_name',
      'company_address',
      'tax_id',
      'company_email',
      'dpo_name',
      'dpo_email',
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
    if (!emailRegex.test(settings.company_email)) {
      return NextResponse.json(
        { error: 'Invalid company_email format' },
        { status: 400 }
      );
    }
    if (!emailRegex.test(settings.dpo_email)) {
      return NextResponse.json(
        { error: 'Invalid dpo_email format' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get existing settings to track changes for audit log
    const { data: existingSettings } = await supabase
      .from('legal_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Update or insert settings
    // Since we only store one row, we'll update the first row if it exists
    let updatedSettings;
    if (existingSettings) {
      const { data, error: updateError } = await supabase
        .from('legal_settings')
        .update({ settings })
        .eq('id', existingSettings.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating legal settings:', updateError);
        return NextResponse.json(
          { error: 'Failed to update legal settings' },
          { status: 500 }
        );
      }
      updatedSettings = data;
    } else {
      // Insert new settings if none exist
      const { data, error: insertError } = await supabase
        .from('legal_settings')
        .insert({ settings })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting legal settings:', insertError);
        return NextResponse.json(
          { error: 'Failed to create legal settings' },
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
        resource_type: 'legal_settings',
        resource_id: updatedSettings.id,
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
    console.error('Error in legal-settings PUT API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
