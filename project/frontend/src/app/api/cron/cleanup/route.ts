import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const CRON_SECRET = process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN

/**
 * GET /api/cron/cleanup
 * Periodic GDPR data retention cleanup job:
 * 1. Delete conversations older than 1 year
 * 2. Delete audit logs older than 2 years
 * 3. Delete marketing events (ab_events) older than 6 months
 * 4. Delete anonymous conversations older than 7 days
 * 5. Delete user_usage rows older than 90 days
 * 6. Clean drip_queue sent entries older than 30 days
 *
 * Intended to be called by Vercel Cron or external scheduler.
 * Protected by Bearer token authentication.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = {}

  try {
    // 1. Delete conversations older than 1 year
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    // Get old conversation IDs (batch process for performance)
    const { data: oldConvs } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .lt('updated_at', oneYearAgo.toISOString())
      .limit(500)

    if (oldConvs && oldConvs.length > 0) {
      const ids = oldConvs.map((c) => c.id)

      // Delete messages first (foreign key constraint)
      await supabaseAdmin
        .from('messages')
        .delete()
        .in('conversation_id', ids)

      // Delete conversations
      const { count } = await supabaseAdmin
        .from('conversations')
        .delete({ count: 'exact' })
        .in('id', ids)

      results.conversations = `Deleted ${count || 0} conversations older than 1 year`
    } else {
      results.conversations = 'No old conversations to clean'
    }

    // 2. Delete audit logs older than 2 years
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    const { count: auditCount } = await supabaseAdmin
      .from('audit_log')
      .delete({ count: 'exact' })
      .lt('created_at', twoYearsAgo.toISOString())

    results.auditLogs = `Deleted ${auditCount || 0} audit logs older than 2 years`

    // 3. Delete marketing events (ab_events) older than 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { count: abEventsCount } = await supabaseAdmin
      .from('ab_events')
      .delete({ count: 'exact' })
      .lt('created_at', sixMonthsAgo.toISOString())

    results.marketingEvents = `Deleted ${abEventsCount || 0} marketing events older than 6 months`

    // 4. Delete anonymous conversations > 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Get anonymous conversation IDs
    const { data: anonConvs } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .is('user_id', null)
      .lt('updated_at', sevenDaysAgo.toISOString())
      .limit(500)

    if (anonConvs && anonConvs.length > 0) {
      const ids = anonConvs.map((c) => c.id)

      // Delete messages first
      await supabaseAdmin
        .from('messages')
        .delete()
        .in('conversation_id', ids)

      // Delete conversations
      const { count } = await supabaseAdmin
        .from('conversations')
        .delete({ count: 'exact' })
        .in('id', ids)

      results.anonymousConversations = `Deleted ${count || 0} anonymous conversations older than 7 days`
    } else {
      results.anonymousConversations = 'No anonymous conversations to clean'
    }

    // 5. Delete user_usage rows > 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { count: usageCount } = await supabaseAdmin
      .from('user_usage')
      .delete({ count: 'exact' })
      .lt('created_at', ninetyDaysAgo.toISOString())

    results.userUsage = `Deleted ${usageCount || 0} old usage records`

    // 6. Clean drip_queue sent entries > 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: dripCount } = await supabaseAdmin
      .from('drip_queue')
      .delete({ count: 'exact' })
      .eq('status', 'sent')
      .lt('sent_at', thirtyDaysAgo.toISOString())

    results.dripQueue = `Deleted ${dripCount || 0} old drip entries`

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Cleanup cron error:', error)
    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
