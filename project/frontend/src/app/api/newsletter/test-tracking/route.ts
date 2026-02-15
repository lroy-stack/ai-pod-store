/**
 * Test Newsletter Tracking
 * POST /api/newsletter/test-tracking - Simulate newsletter send with tracking
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  try {
    const supabase = supabaseAdmin;

    // Get a campaign to simulate sending
    const { data: campaigns, error: fetchError } = await supabase
      .from('newsletter_campaigns')
      .select('*')
      .eq('status', 'draft')
      .limit(1);

    if (fetchError || !campaigns || campaigns.length === 0) {
      return NextResponse.json(
        { error: 'No draft campaigns found to test' },
        { status: 404 }
      );
    }

    const campaign = campaigns[0];

    // Simulate sending to 100 subscribers
    const sent_count = 100;
    const delivered_count = 98; // 2% bounce rate
    const opens = 45; // 45 opens out of 98 delivered
    const clicks = 12; // 12 clicks out of 45 opens
    const unsubscribes = 2; // 2 unsubscribes

    const open_rate = (opens / delivered_count) * 100; // 45.92%
    const click_rate = (clicks / opens) * 100; // 26.67%

    // Update campaign with tracking data
    const { data: updated, error: updateError } = await supabase
      .from('newsletter_campaigns')
      .update({
        status: 'sent',
        sent_count,
        delivered_count,
        open_rate: parseFloat(open_rate.toFixed(2)),
        click_rate: parseFloat(click_rate.toFixed(2)),
        unsubscribe_count: unsubscribes,
        sent_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Newsletter tracking test complete',
      campaign: {
        id: updated.id,
        name: updated.campaign_name,
        locale: updated.locale,
        segment: updated.segment,
      },
      tracking: {
        sent_count: updated.sent_count,
        delivered_count: updated.delivered_count,
        open_rate: updated.open_rate,
        click_rate: updated.click_rate,
        unsubscribe_count: updated.unsubscribe_count,
        sent_at: updated.sent_at,
      },
      metrics: {
        delivery_rate: `${((delivered_count / sent_count) * 100).toFixed(2)}%`,
        open_rate_desc: `${opens} opens / ${delivered_count} delivered = ${open_rate.toFixed(2)}%`,
        click_rate_desc: `${clicks} clicks / ${opens} opens = ${click_rate.toFixed(2)}%`,
        unsubscribe_rate: `${((unsubscribes / delivered_count) * 100).toFixed(2)}%`,
      },
    });
  } catch (error) {
    console.error('Test tracking API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
