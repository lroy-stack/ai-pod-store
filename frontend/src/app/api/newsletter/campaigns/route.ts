/**
 * Newsletter Campaigns API
 * GET /api/newsletter/campaigns - List campaigns with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { newsletterLimiter, getClientIP } from '@/lib/rate-limit';
import { requireAuth, authErrorResponse } from '@/lib/auth-guard';

export async function GET(request: NextRequest) {
  // Auth required — campaigns are admin-only
  try {
    await requireAuth(request);
  } catch (e) {
    return authErrorResponse(e);
  }

  // Rate limiting: 10 requests per minute per IP
  const clientIP = getClientIP(request)
  const rateLimitResult = newsletterLimiter.check(`newsletter:${clientIP}`)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'Retry-After': '60',
        }
      }
    )
  }

  try {
    const { searchParams } = new URL(request.url);
    const segment = searchParams.get('segment');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const supabase = supabaseAdmin;

    let query = supabase
      .from('newsletter_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (segment) {
      query = query.eq('segment', segment);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaigns: data, count: data?.length || 0 });
  } catch (error) {
    console.error('Newsletter campaigns API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
