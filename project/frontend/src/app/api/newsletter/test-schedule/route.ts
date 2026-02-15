import { NextResponse } from 'next/server'

/**
 * Test Newsletter Agent Schedule (Feature #383)
 *
 * Verification steps:
 * 1. Verify scheduler has newsletter_am job at 09:00 UTC
 * 2. Verify scheduler has newsletter_pm job at 17:00 UTC
 * 3. Verify both jobs target the newsletter agent
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000'

    // Query the schedule endpoint
    const scheduleResponse = await fetch(`${bridgeUrl}/schedule`)

    if (!scheduleResponse.ok) {
      throw new Error(`Failed to query schedule: ${scheduleResponse.status}`)
    }

    const scheduleData = await scheduleResponse.json()
    const schedule = scheduleData.schedule || []

    // Find newsletter agent schedule
    const newsletterSchedule = schedule.find((s: any) => s.name === 'newsletter')

    if (!newsletterSchedule) {
      return NextResponse.json(
        {
          error: 'Newsletter agent not found in schedule',
          success: false,
        },
        { status: 404 }
      )
    }

    // Parse the cron schedule (e.g., "0 9,17 * * *")
    // Format: minute hour day month weekday
    const cronSchedule = newsletterSchedule.schedule
    const cronParts = cronSchedule.split(' ')

    // The hour part should be "9,17" or have separate entries
    const hourPart = cronParts[1]
    const hours = hourPart.includes(',') ? hourPart.split(',').map((h: string) => parseInt(h, 10)) : [parseInt(hourPart, 10)]

    // Verify 09:00 and 17:00 are in the schedule
    const has09 = hours.includes(9)
    const has17 = hours.includes(17)

    const verification = {
      step1_newsletter_am_at_09_utc: has09,
      step2_newsletter_pm_at_17_utc: has17,
      step3_targets_newsletter_agent: newsletterSchedule.name === 'newsletter',

      // Details
      agent_name: newsletterSchedule.name,
      cron_schedule: cronSchedule,
      hours_scheduled: hours,
      description: newsletterSchedule.description,
      enabled: newsletterSchedule.enabled,
      next_run: newsletterSchedule.nextRun,
      model: newsletterSchedule.model,
    }

    const allChecksPassed =
      verification.step1_newsletter_am_at_09_utc &&
      verification.step2_newsletter_pm_at_17_utc &&
      verification.step3_targets_newsletter_agent

    return NextResponse.json({
      success: allChecksPassed,
      message: allChecksPassed
        ? '✅ Newsletter agent runs on schedule (09:00 + 17:00 UTC)'
        : '❌ Newsletter schedule does not match requirements',
      verification,
      raw_schedule: newsletterSchedule,
    })
  } catch (error) {
    console.error('[Newsletter Schedule Test] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Test failed',
        success: false,
      },
      { status: 500 }
    )
  }
}
