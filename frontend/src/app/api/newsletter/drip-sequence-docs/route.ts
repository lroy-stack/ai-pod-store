/**
 * Newsletter Drip Sequence Documentation
 *
 * GET /api/newsletter/drip-sequence-docs
 * Returns comprehensive documentation of the post-purchase drip sequence
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BRAND, COMPANY, CONTACT } from '@/lib/store-config'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: Request) {
  try {
    // Require internal auth (cron secret or admin token)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
    }
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch post-purchase drip campaigns
    const { data: campaigns } = await supabase
      .from('newsletter_campaigns')
      .select('*')
      .eq('drip_sequence', 'post_purchase')
      .order('drip_step', { ascending: true })

    const day7 = campaigns?.find(c => c.drip_step === 7)
    const day14 = campaigns?.find(c => c.drip_step === 14)

    return NextResponse.json({
      documentation: {
        overview: 'Post-Purchase Email Drip Sequence - Automated customer follow-up after delivery',
        trigger: 'Newsletter agent PM cycle (17:00 UTC) checks orders.delivered_at timestamp',
        sequence: [
          {
            step: 'Day 7 - Satisfaction Survey',
            timing: '7 days after delivery',
            campaign_id: day7?.id,
            campaign_name: day7?.campaign_name,
            purpose: 'Gather customer feedback on order quality and experience',
            content: {
              subject_a: day7?.subject_a,
              subject_b: day7?.subject_b,
              preview_text: day7?.preview_text,
              cta_a: day7?.cta_a,
              cta_b: day7?.cta_b,
            },
            includes_survey: true,
            survey_questions: [
              'How satisfied are you with your order? (1-5 stars)',
              'How was the quality of the product?',
              'How was the shipping experience?',
              'Would you recommend ' + (process.env.NEXT_PUBLIC_SITE_NAME || 'us') + ' to a friend?',
            ],
          },
          {
            step: 'Day 14 - Review Request',
            timing: '14 days after delivery',
            campaign_id: day14?.id,
            campaign_name: day14?.campaign_name,
            purpose: 'Encourage product reviews and social proof generation',
            content: {
              subject_a: day14?.subject_a,
              subject_b: day14?.subject_b,
              preview_text: day14?.preview_text,
              cta_a: day14?.cta_a,
              cta_b: day14?.cta_b,
            },
            includes_review_request: true,
            incentive: '10% discount on next order for leaving a review',
          },
        ],
        implementation: {
          database_table: 'newsletter_campaigns',
          drip_sequence_field: 'drip_sequence',
          drip_sequence_value: 'post_purchase',
          drip_step_field: 'drip_step',
          agent: 'newsletter',
          model: 'claude-sonnet-4-5-20250929',
          tools: ['supabase', 'resend', 'gemini'],
          schedule: '09:00 UTC (campaign creation) + 17:00 UTC (drip sequence processing)',
        },
        agent_logic: {
          description: 'Newsletter agent queries orders table during PM cycle',
          query: `
SELECT o.id, o.user_id, o.customer_email, o.locale, o.delivered_at
FROM orders o
WHERE o.status = 'delivered'
  AND o.delivered_at IS NOT NULL
  AND (
    -- Day 7 emails
    DATE(o.delivered_at) = DATE(NOW() - INTERVAL '7 days')
    OR
    -- Day 14 emails
    DATE(o.delivered_at) = DATE(NOW() - INTERVAL '14 days')
  )
          `,
          workflow: [
            '1. Query orders delivered 7 and 14 days ago',
            '2. Fetch matching drip campaigns from newsletter_campaigns',
            '3. Personalize email content with customer name and order details',
            '4. Send via Resend (respecting email preferences)',
            '5. Update newsletter_segments.md with send history',
            '6. Log sends to agent_events table',
          ],
        },
        compliance: {
          can_spam: 'All emails include unsubscribe link and physical address',
          physical_address: COMPANY.address,
          sender: `${BRAND.name} <${CONTACT.noreply}>`,
          respect_preferences: 'Honors users.notification_preferences.email setting',
          locale_aware: 'Sends in customer preferred language (en/es/de)',
        },
        verification: {
          day7_configured: !!day7,
          day7_includes_survey: day7?.subject_a?.toLowerCase().includes('feedback') ||
                                day7?.subject_a?.toLowerCase().includes('survey') ||
                                day7?.cta_a?.toLowerCase().includes('survey') ||
                                day7?.preview_text?.toLowerCase().includes('survey'),
          day14_configured: !!day14,
          day14_includes_review_request: day14?.subject_a?.toLowerCase().includes('review') ||
                                          day14?.cta_a?.toLowerCase().includes('review'),
          all_checks_passed: (
            !!day7 &&
            !!day14 &&
            (day7?.subject_a?.toLowerCase().includes('feedback') || day7?.cta_a?.toLowerCase().includes('survey')) &&
            day14?.cta_a?.toLowerCase().includes('review')
          ),
        },
      },
    })
  } catch (error) {
    console.error('Error fetching drip sequence documentation:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch documentation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
