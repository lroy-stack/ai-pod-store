/**
 * Test Newsletter Drip Sequence Trigger
 *
 * POST /api/newsletter/test-drip-trigger
 * Manually triggers newsletter agent to process drip sequences
 */

import { NextResponse } from 'next/server'

export async function POST() {
  const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000'

  try {
    // Trigger newsletter agent with drip sequence task
    const response = await fetch(`${bridgeUrl}/agents/newsletter/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: `Process post-purchase drip sequence emails:
1. Query supabase for orders with status='delivered'
2. Calculate days since delivery using delivered_at timestamp
3. For orders delivered EXACTLY 7 days ago:
   - Send Day 7 email (satisfaction survey) from newsletter_campaigns where drip_sequence='post_purchase' and drip_step=7
   - Include satisfaction survey link
4. For orders delivered EXACTLY 14 days ago:
   - Send Day 14 email (review request) from newsletter_campaigns where drip_sequence='post_purchase' and drip_step=14
   - Include review link and 10% discount code
5. Update newsletter_segments.md with drip sends
6. Log all email sends to database

IMPORTANT: Use the pre-configured campaigns in newsletter_campaigns table. Do NOT create new campaigns.
Query: SELECT * FROM newsletter_campaigns WHERE drip_sequence='post_purchase' ORDER BY drip_step
Then send using resend tool to eligible customers.`,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to trigger newsletter agent: ${response.status} ${errorText}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Newsletter agent triggered for drip sequence processing',
      session_id: result.session_id,
      agent: 'newsletter',
      task: 'post_purchase_drip_sequence',
      note: 'Check agent_events table for session events. The agent will query for delivered orders and send Day 7 and Day 14 emails.',
    })
  } catch (error) {
    console.error('Error triggering newsletter drip sequence:', error)

    // If PodClaw bridge is offline, return explanation
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        {
          error: 'PodClaw bridge offline',
          message: 'Cannot trigger newsletter agent - PodClaw service not running',
          details: 'Start PodClaw with: cd project/podclaw && python3 -m podclaw.main --workspace ../../',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to trigger newsletter agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
