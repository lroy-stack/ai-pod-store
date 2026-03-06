import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth-middleware';

/**
 * GET /api/monitoring/errors
 *
 * Fetches error logs for the admin monitoring dashboard
 * Query params:
 * - limit: number of errors to fetch (default: 50)
 * - days: number of days to look back (default: 7)
 */
export const GET = withAuth(async (req, session) => {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const days = parseInt(searchParams.get('days') || '7');

    // Create admin Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Fetch error logs
    const { data: errors, error: fetchError } = await supabase
      .from('error_logs')
      .select('*')
      .gte('last_seen', dateThreshold.toISOString())
      .order('count', { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error('Error fetching error logs:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch error logs' },
        { status: 500 }
      );
    }

    // Fetch trend data (errors per day for the last N days)
    const { data: trendData, error: trendError } = await supabase
      .from('error_logs')
      .select('first_seen, count')
      .gte('first_seen', dateThreshold.toISOString())
      .order('first_seen', { ascending: true });

    if (trendError) {
      console.error('Error fetching trend data:', trendError);
      return NextResponse.json(
        { error: 'Failed to fetch trend data' },
        { status: 500 }
      );
    }

    // Aggregate trend data by day
    const trendsMap = new Map<string, number>();
    trendData?.forEach((error) => {
      const date = new Date(error.first_seen).toISOString().split('T')[0];
      trendsMap.set(date, (trendsMap.get(date) || 0) + error.count);
    });

    const trends = Array.from(trendsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate stats
    const totalErrors = errors?.reduce((sum, e) => sum + e.count, 0) || 0;
    const uniqueErrors = errors?.length || 0;

    return NextResponse.json({
      errors: errors || [],
      trends,
      stats: {
        totalErrors,
        uniqueErrors,
        days,
      },
    });
  } catch (error) {
    console.error('Unexpected error in /api/monitoring/errors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
