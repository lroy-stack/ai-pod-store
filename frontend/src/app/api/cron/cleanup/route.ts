import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyCronSecret } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/cleanup
 * Periodic GDPR data retention cleanup job:
 * 1. Delete conversations older than configured retention period
 * 2. Delete audit logs older than configured retention period
 * 3. Delete marketing events (ab_events) older than configured retention period
 * 4. Delete anonymous conversations older than 7 days
 * 5. Delete user_usage rows older than 90 days
 * 6. Clean drip_queue sent entries older than 30 days
 *
 * Retention periods are read from legal_settings table (configurable in admin).
 * Intended to be called by Vercel Cron or external scheduler.
 * Protected by Bearer token authentication.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (timing-safe)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = {}

  try {
    // Fetch retention periods from legal_settings
    const { data: legalSettings } = await supabaseAdmin
      .from('legal_settings')
      .select('settings')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Default retention periods (in days) if not configured
    const retentionConversations = legalSettings?.settings?.retention_conversations || 365
    const retentionAuditLogs = legalSettings?.settings?.retention_audit_logs || 730
    const retentionMarketingEvents = legalSettings?.settings?.retention_marketing_events || 180

    // 1. Delete conversations older than configured retention period
    const conversationCutoff = new Date()
    conversationCutoff.setDate(conversationCutoff.getDate() - retentionConversations)

    // Get old conversation IDs (batch process for performance)
    const { data: oldConvs } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .lt('updated_at', conversationCutoff.toISOString())
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

      results.conversations = `Deleted ${count || 0} conversations older than ${retentionConversations} days`
    } else {
      results.conversations = `No conversations to clean (retention: ${retentionConversations} days)`
    }

    // 2. Delete audit logs older than configured retention period
    const auditLogCutoff = new Date()
    auditLogCutoff.setDate(auditLogCutoff.getDate() - retentionAuditLogs)

    const { count: auditCount } = await supabaseAdmin
      .from('audit_log')
      .delete({ count: 'exact' })
      .lt('created_at', auditLogCutoff.toISOString())

    results.auditLogs = `Deleted ${auditCount || 0} audit logs older than ${retentionAuditLogs} days`

    // 3. Delete marketing events (ab_events) older than configured retention period
    const marketingEventCutoff = new Date()
    marketingEventCutoff.setDate(marketingEventCutoff.getDate() - retentionMarketingEvents)

    const { count: abEventsCount } = await supabaseAdmin
      .from('ab_events')
      .delete({ count: 'exact' })
      .lt('created_at', marketingEventCutoff.toISOString())

    results.marketingEvents = `Deleted ${abEventsCount || 0} marketing events older than ${retentionMarketingEvents} days`

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
