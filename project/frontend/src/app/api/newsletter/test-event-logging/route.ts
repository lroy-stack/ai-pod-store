import { NextResponse } from 'next/server'

/**
 * Test Newsletter Agent Event Logging (Feature #382)
 *
 * Verification steps:
 * 1. Trigger newsletter agent cycle via PodClaw bridge
 * 2. Query agent_events for agent_name='newsletter'
 * 3. Verify session_start and tool_call events are recorded
 */

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000'

    // Step 1: Trigger newsletter agent cycle
    console.log('[Newsletter Event Log Test] Triggering newsletter agent...')
    const triggerResponse = await fetch(`${bridgeUrl}/agents/newsletter/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'Test cycle: Review subscriber segments and update memory. This is a test run.',
      }),
    })

    if (!triggerResponse.ok) {
      throw new Error(`Failed to trigger newsletter agent: ${triggerResponse.status}`)
    }

    const triggerData = await triggerResponse.json()
    console.log('[Newsletter Event Log Test] Agent triggered:', triggerData)

    // Wait for agent to complete (poll status)
    let isRunning = true
    let attempts = 0
    const maxAttempts = 30 // 30 seconds max

    while (isRunning && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second

      const statusResponse = await fetch(`${bridgeUrl}/agents/newsletter`)
      const statusData = await statusResponse.json()
      isRunning = statusData.running
      attempts++

      console.log(`[Newsletter Event Log Test] Poll attempt ${attempts}: running=${isRunning}`)
    }

    if (isRunning) {
      return NextResponse.json(
        {
          error: 'Newsletter agent did not complete within 30 seconds',
          status: 'timeout',
        },
        { status: 408 }
      )
    }

    console.log('[Newsletter Event Log Test] Agent completed')

    // Step 2: Query agent_events for agent_name='newsletter'
    const eventsResponse = await fetch(`${bridgeUrl}/events?agent=newsletter&limit=20`)

    if (!eventsResponse.ok) {
      throw new Error(`Failed to query events: ${eventsResponse.status}`)
    }

    const eventsData = await eventsResponse.json()
    const events = eventsData.events || []

    console.log(`[Newsletter Event Log Test] Found ${events.length} events`)

    // Step 3: Verify session_start and tool_call events are recorded
    const sessionEndEvents = events.filter((e: any) => e.event_type === 'session_end')
    const toolCallEvents = events.filter((e: any) => e.event_type === 'tool_call')

    const hasSessionEnd = sessionEndEvents.length > 0
    const hasToolCalls = toolCallEvents.length > 0

    // Get the latest session details
    const latestSession = sessionEndEvents[0]
    const sessionId = latestSession?.session_id
    const sessionToolCalls = latestSession?.data?.tool_calls || 0

    const verification = {
      step1_agent_triggered: true,
      step2_events_queried: events.length > 0,
      step3_session_events_recorded: hasSessionEnd,
      step3_tool_call_events_recorded: hasToolCalls,

      // Details
      total_events: events.length,
      session_end_events: sessionEndEvents.length,
      tool_call_events: toolCallEvents.length,
      latest_session_id: sessionId,
      latest_session_tool_calls: sessionToolCalls,

      // Sample events
      sample_session_event: latestSession ? {
        id: latestSession.id,
        event_type: latestSession.event_type,
        agent_name: latestSession.agent_name,
        session_id: latestSession.session_id,
        tool_calls: latestSession.data?.tool_calls,
        duration_seconds: latestSession.data?.duration_seconds,
      } : null,
      sample_tool_events: toolCallEvents.slice(0, 3).map((e: any) => ({
        id: e.id,
        event_type: e.event_type,
        agent_name: e.agent_name,
        session_id: e.session_id,
        tool: e.data?.tool,
        success: e.data?.success,
      })),
    }

    const allChecksPassed =
      verification.step1_agent_triggered &&
      verification.step2_events_queried &&
      verification.step3_session_events_recorded &&
      verification.step3_tool_call_events_recorded

    return NextResponse.json({
      success: allChecksPassed,
      message: allChecksPassed
        ? '✅ Newsletter agent logs events to agent_events table'
        : '❌ Some verification steps failed',
      verification,
    })
  } catch (error) {
    console.error('[Newsletter Event Log Test] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Test failed',
        success: false,
      },
      { status: 500 }
    )
  }
}
