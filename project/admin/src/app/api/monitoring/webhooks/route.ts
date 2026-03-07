import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/monitoring/webhooks
 * Returns last 100 webhook events from processed_events table
 * Query params:
 *   - source: filter by provider (stripe|printful|telegram)
 *   - limit: number of events (default: 100)
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    let query = supabaseAdmin
      .from('processed_events')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(limit);

    if (source) {
      query = query.eq('provider', source);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[monitoring/webhooks]', error);
      return NextResponse.json({ error: 'Failed to fetch webhook events' }, { status: 500 });
    }

    const events = (data || []).map((event) => ({
      id: event.id,
      source: event.provider,
      eventType: event.event_type,
      eventId: event.event_id,
      status: event.status_code ? (event.status_code >= 200 && event.status_code < 300 ? 'success' : 'error') : 'processed',
      statusCode: event.status_code,
      processedAt: event.processed_at,
      createdAt: event.created_at,
    }));

    // Get source breakdown for filter
    const { data: sourceCounts } = await supabaseAdmin
      .from('processed_events')
      .select('provider')
      .order('provider');

    const providers = Array.from(new Set((sourceCounts || []).map((r) => r.provider)));

    return NextResponse.json({ events, providers, total: events.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
});
