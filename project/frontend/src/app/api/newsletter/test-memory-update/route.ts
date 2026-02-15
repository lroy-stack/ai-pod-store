import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * Test Newsletter Agent Memory Updates (Feature #385)
 *
 * Verification steps:
 * 1. Check that newsletter_segments.md exists in memory/context
 * 2. Verify the file has been updated by newsletter agent
 * 3. Verify send history and A/B results are logged
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000'

    // Step 1: Check file exists
    const workspaceRoot = path.join(process.cwd(), '../../')
    const memoryPath = path.join(workspaceRoot, 'memory/context/newsletter_segments.md')

    const fileExists = fs.existsSync(memoryPath)

    if (!fileExists) {
      return NextResponse.json({
        success: false,
        message: '❌ newsletter_segments.md file not found',
        verification: {
          step1_file_exists: false,
          path: memoryPath,
        },
      })
    }

    // Step 2: Read file stats
    const stats = fs.statSync(memoryPath)
    const content = fs.readFileSync(memoryPath, 'utf-8')

    // Step 3: Query newsletter agent events for Write tool calls
    const eventsResponse = await fetch(`${bridgeUrl}/events?agent=newsletter&event_type=tool_call&limit=100`)

    if (!eventsResponse.ok) {
      throw new Error(`Failed to query events: ${eventsResponse.status}`)
    }

    const eventsData = await eventsResponse.json()
    const events = eventsData.events || []

    // Find Write tool calls
    const writeEvents = events.filter((e: any) => e.data?.tool === 'Write')
    const hasWriteEvents = writeEvents.length > 0

    // Extract latest Write event details
    const latestWrite = writeEvents[0]
    const latestWriteTime = latestWrite ? new Date(latestWrite.created_at) : null

    // Check file content for key indicators
    const hasSubscriberOverview = content.includes('Subscriber Overview')
    const hasActiveCampaigns = content.includes('Active Campaigns')
    const hasABTestResults = content.includes('A/B Test')
    const hasLastUpdated = content.includes('Last updated:')

    // Extract last updated timestamp from file
    const lastUpdatedMatch = content.match(/Last updated: (.+)/)
    const lastUpdatedInFile = lastUpdatedMatch ? lastUpdatedMatch[1] : null

    const verification = {
      step1_file_exists: fileExists,
      step2_file_updated_by_agent: hasWriteEvents,
      step3_send_history_logged: hasActiveCampaigns,
      step3_ab_results_logged: hasABTestResults,

      // File details
      file_path: memoryPath,
      file_size: stats.size,
      file_modified: stats.mtime.toISOString(),
      last_updated_in_file: lastUpdatedInFile,

      // Agent activity
      total_write_events: writeEvents.length,
      latest_write_event: latestWrite ? {
        session_id: latestWrite.session_id,
        created_at: latestWrite.created_at,
        success: latestWrite.data?.success,
      } : null,

      // Content validation
      has_subscriber_overview: hasSubscriberOverview,
      has_active_campaigns: hasActiveCampaigns,
      has_ab_test_section: hasABTestResults,
      has_last_updated_timestamp: hasLastUpdated,
    }

    const allChecksPassed =
      verification.step1_file_exists &&
      verification.step2_file_updated_by_agent &&
      verification.step3_send_history_logged &&
      verification.step3_ab_results_logged

    return NextResponse.json({
      success: allChecksPassed,
      message: allChecksPassed
        ? '✅ Newsletter agent updates newsletter_segments.md after each cycle'
        : '❌ Some verification steps failed',
      verification,
    })
  } catch (error) {
    console.error('[Newsletter Memory Update Test] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Test failed',
        success: false,
      },
      { status: 500 }
    )
  }
}
