import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/cron/cleanup
 * Periodic GDPR cleanup job:
 * 1. Delete anonymous conversations older than 7 days
 * 2. Delete user_usage rows older than 90 days
 * 3. Clean drip_queue sent entries older than 30 days
 *
 * Intended to be called by Vercel Cron or external scheduler.
 * Protected by CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = {}

  try {
    // 1. Delete anonymous conversations > 7 days
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

      results.anonymousConversations = `Deleted ${count || 0} anonymous conversations`
    } else {
      results.anonymousConversations = 'No anonymous conversations to clean'
    }

    // 2. Delete user_usage rows > 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { count: usageCount } = await supabaseAdmin
      .from('user_usage')
      .delete({ count: 'exact' })
      .lt('created_at', ninetyDaysAgo.toISOString())

    results.userUsage = `Deleted ${usageCount || 0} old usage records`

    // 3. Clean drip_queue sent entries > 30 days
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
