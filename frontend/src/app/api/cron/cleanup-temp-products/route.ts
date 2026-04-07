/**
 * Cleanup Orphaned Printify Temp Products Cron
 *
 * GET /api/cron/cleanup-temp-products
 * Deletes temp Printify products created for personalizations that are:
 * - Older than 24 hours
 * - Not associated with any orders (status != 'ordered')
 *
 * Protected by bearer token auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProvider, initializeProviders } from '@/lib/pod'
import { verifyCronSecret } from '@/lib/rate-limit'
import { acquireLock, recordRun } from '@/lib/reliability/cron-lock'

const CRON_SECRET = process.env.CRON_SECRET
const CRON_NAME = 'cleanup-temp-products'

export async function GET(req: NextRequest) {
  const startTime = Date.now()

  // Verify cron secret (timing-safe)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Acquire lock to prevent concurrent executions
  const lock = await acquireLock(CRON_NAME)
  if (!lock.acquired) {
    await recordRun(CRON_NAME, 'skipped', Date.now() - startTime, 'Another instance is running')
    return NextResponse.json({
      message: 'Job already running, skipping',
      skipped: true,
    })
  }

  try {
    initializeProviders()

    // Find orphaned temp products: >24h old, not ordered, has provider_temp_product_id
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const { data: orphaned, error: fetchError } = await supabaseAdmin
      .from('personalizations')
      .select('id, provider_temp_product_id, status, created_at')
      .not('provider_temp_product_id', 'is', null)
      .neq('status', 'ordered')
      .lt('created_at', twentyFourHoursAgo.toISOString())
      .limit(50) // Process in batches to avoid timeouts

    if (fetchError) {
      console.error('[cleanup-temp-products] Failed to fetch orphaned personalizations:', fetchError)
      await recordRun(CRON_NAME, 'failed', Date.now() - startTime, fetchError.message)
      return NextResponse.json({ error: 'Failed to fetch orphaned records' }, { status: 500 })
    }

    if (!orphaned || orphaned.length === 0) {
      await recordRun(CRON_NAME, 'completed', Date.now() - startTime, undefined, 0)
      return NextResponse.json({ message: 'No orphaned temp products found', cleaned: 0 })
    }

    const results: Array<{ id: string; productId: string; success: boolean; error?: string }> = []

    // Delete temp products from Printify
    for (const personalization of orphaned) {
      try {
        const tempProductId = personalization.provider_temp_product_id!
        await getProvider().deleteProduct(tempProductId)

        // Update personalization status to 'expired'
        await supabaseAdmin
          .from('personalizations')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('id', personalization.id)

        results.push({
          id: personalization.id,
          productId: tempProductId,
          success: true,
        })

        console.log('[cleanup-temp-products] Deleted temp product:', tempProductId)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'

        const failedTempId = personalization.provider_temp_product_id!
        results.push({
          id: personalization.id,
          productId: failedTempId,
          success: false,
          error: errorMessage,
        })

        console.error('[cleanup-temp-products] Failed to delete temp product:', failedTempId, errorMessage)
      }
    }

    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    await recordRun(CRON_NAME, 'completed', Date.now() - startTime, undefined, succeeded)

    return NextResponse.json({
      message: `Cleaned ${succeeded} orphaned temp products (${failed} failed)`,
      cleaned: succeeded,
      failed,
      results,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cleanup-temp-products] Unexpected error:', err)
    await recordRun(CRON_NAME, 'failed', Date.now() - startTime, errorMessage)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
