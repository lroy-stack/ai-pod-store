/**
 * Newsletter Campaigns API
 * GET /api/newsletter/campaigns - List campaigns with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
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
