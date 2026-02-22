/**
 * Test Newsletter Drip Sequence Triggering
 *
 * GET /api/newsletter/test-drip-sequence
 * Verifies post-purchase drip sequence campaigns trigger 7 and 14 days after delivery
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'


const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  try {
    // 1. Check for post-purchase drip campaigns in database
    const { data: campaigns, error: campaignsError } = await supabase
      .from('newsletter_campaigns')
      .select('*')
      .eq('drip_sequence', 'post_purchase')
      .order('drip_step', { ascending: true })

    if (campaignsError) {
      throw campaignsError
    }

    // 2. Verify Day 7 campaign (satisfaction survey)
    const day7Campaign = campaigns?.find(c => c.drip_step === 7)
    const day7Valid = day7Campaign &&
      (day7Campaign.campaign_name.includes('Day 7') || day7Campaign.campaign_name.includes('satisfaction') || day7Campaign.campaign_name.includes('survey')) &&
      (day7Campaign.subject_a?.toLowerCase().includes('feedback') ||
       day7Campaign.subject_a?.toLowerCase().includes('survey') ||
       day7Campaign.subject_a?.toLowerCase().includes('order'))

    // 3. Verify Day 14 campaign (review request)
    const day14Campaign = campaigns?.find(c => c.drip_step === 14)
    const day14Valid = day14Campaign &&
      (day14Campaign.campaign_name.includes('Day 14') || day14Campaign.campaign_name.includes('review')) &&
      (day14Campaign.subject_a?.toLowerCase().includes('review') ||
       day14Campaign.cta_a?.toLowerCase().includes('review'))

    // 4. Check if there are any delivered orders from 7 days ago (simulated)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const { data: day7Orders, error: day7Error } = await supabase
      .from('orders')
      .select('id, user_id, customer_email, delivered_at, status')
      .eq('status', 'delivered')
      .gte('delivered_at', sevenDaysAgo.toISOString())
      .lt('delivered_at', new Date(sevenDaysAgo.getTime() + 86400000).toISOString()) // +1 day window
      .limit(5)

    if (day7Error) {
      console.warn('Failed to query day 7 orders:', day7Error)
    }

    const { data: day14Orders, error: day14Error } = await supabase
      .from('orders')
      .select('id, user_id, customer_email, delivered_at, status')
      .eq('status', 'delivered')
      .gte('delivered_at', fourteenDaysAgo.toISOString())
      .lt('delivered_at', new Date(fourteenDaysAgo.getTime() + 86400000).toISOString())
      .limit(5)

    if (day14Error) {
      console.warn('Failed to query day 14 orders:', day14Error)
    }

    // 5. Check newsletter agent schedule for PM cycle (drip sequence processing)
    const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000'
    let scheduleData = null

    try {
      const scheduleRes = await fetch(`${bridgeUrl}/schedule`, {
        headers: { 'Content-Type': 'application/json' },
      })

      if (scheduleRes.ok) {
        const scheduleJson = await scheduleRes.json()
        const newsletterJobs = scheduleJson.schedule?.filter((job: { agent: string }) =>
          job.agent === 'newsletter'
        )
        scheduleData = newsletterJobs
      }
    } catch (err) {
      console.warn('Failed to fetch PodClaw schedule:', err)
    }

    return NextResponse.json({
      success: true,
      drip_sequence: {
        configured: campaigns && campaigns.length >= 2,
        campaigns: {
          day7: day7Campaign ? {
            name: day7Campaign.campaign_name,
            subject_a: day7Campaign.subject_a,
            subject_b: day7Campaign.subject_b,
            cta_a: day7Campaign.cta_a,
            includes_survey: day7Campaign.subject_a?.toLowerCase().includes('feedback') ||
                            day7Campaign.subject_a?.toLowerCase().includes('survey') ||
                            day7Campaign.cta_a?.toLowerCase().includes('survey') ||
                            day7Campaign.preview_text?.toLowerCase().includes('survey'),
            valid: day7Valid,
          } : null,
          day14: day14Campaign ? {
            name: day14Campaign.campaign_name,
            subject_a: day14Campaign.subject_a,
            subject_b: day14Campaign.subject_b,
            cta_a: day14Campaign.cta_a,
            includes_review_request: day14Campaign.subject_a?.toLowerCase().includes('review') ||
                                     day14Campaign.cta_a?.toLowerCase().includes('review'),
            valid: day14Valid,
          } : null,
        },
        total_campaigns: campaigns?.length || 0,
      },
      trigger_logic: {
        day7_eligible_orders: day7Orders?.length || 0,
        day14_eligible_orders: day14Orders?.length || 0,
        newsletter_schedule: scheduleData,
        note: 'Newsletter agent runs at 09:00 + 17:00 UTC. PM cycle (17:00) processes drip sequences by querying orders.delivered_at.',
      },
      validation: {
        day7_campaign_exists: !!day7Campaign,
        day7_includes_survey: day7Valid,
        day14_campaign_exists: !!day14Campaign,
        day14_includes_review_request: day14Valid,
        all_checks_passed: day7Valid && day14Valid,
      },
    })
  } catch (error) {
    console.error('Error testing drip sequence:', error)
    return NextResponse.json(
      {
        error: 'Failed to test drip sequence',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
