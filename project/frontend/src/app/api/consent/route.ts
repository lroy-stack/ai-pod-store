/**
 * POST /api/consent
 * Record user consent grants and withdrawals to user_consents table (GDPR compliance)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIP || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { consents } = body;

    if (!consents || typeof consents !== 'object') {
      return NextResponse.json(
        { error: 'Invalid consent data' },
        { status: 400 }
      );
    }

    // Get user session from cookies (browser requests)
    const accessToken = request.cookies.get('sb-access-token')?.value;

    if (!accessToken) {
      // For anonymous users, we can't record consent in the database
      // Consent is tracked in cookies/localStorage only
      return NextResponse.json({
        success: true,
        message: 'Consent saved (anonymous)',
      });
    }

    // Verify the access token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user) {
      // Invalid token - treat as anonymous
      return NextResponse.json({
        success: true,
        message: 'Consent saved (anonymous)',
      });
    }

    // Get client info for audit trail
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const timestamp = new Date().toISOString();

    // Record each consent type
    const consentRecords = [];

    // Map consent categories to database types
    const consentMapping: Record<string, string> = {
      analytics: 'analytics',
      marketing: 'marketing',
      necessary: 'functional', // Map necessary to functional
    };

    for (const [category, granted] of Object.entries(consents)) {
      const consentType = consentMapping[category];
      if (!consentType) continue; // Skip unknown categories

      consentRecords.push({
        user_id: user.id,
        consent_type: consentType,
        granted: Boolean(granted),
        timestamp,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    }

    if (consentRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No consents to record',
      });
    }

    // Insert consent records using service role (bypasses RLS)
    const { error } = await supabaseAdmin
      .from('user_consents')
      .insert(consentRecords);

    if (error) {
      console.error('Failed to record consents:', error);
      return NextResponse.json(
        { error: 'Failed to record consents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Consent recorded',
      recordsCreated: consentRecords.length,
    });
  } catch (error) {
    console.error('Consent API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/consent
 * Retrieve user's consent history
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await createServerClient(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's consent history (RLS will filter to their own records)
    const { data: consents, error } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to fetch consents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch consents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      consents: consents || [],
    });
  } catch (error) {
    console.error('Consent fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
