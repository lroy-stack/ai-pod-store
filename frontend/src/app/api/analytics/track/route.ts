import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const TrackEventSchema = z.object({
  event_name: z.enum(['view_product', 'add_to_cart', 'begin_checkout', 'purchase']),
  session_id: z.string().uuid(),
  properties: z.record(z.unknown()).optional(),
  page_url: z.string().url().optional(),
  referrer: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = TrackEventSchema.parse(body);

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user ID from session if authenticated
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Insert tracking event
    const { error } = await supabase.from('analytics_events').insert({
      event_name: validated.event_name,
      user_id: userId,
      session_id: validated.session_id,
      properties: validated.properties || {},
      page_url: validated.page_url || null,
      referrer: validated.referrer || null,
    });

    if (error) {
      console.error('Analytics insert error:', error);
      // Don't expose internal errors to client
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Analytics tracking error:', err);
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
