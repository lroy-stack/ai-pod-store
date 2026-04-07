import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyCronSecret } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/zombie-reaper
 *
 * ZombieReaper: Detects and corrects expired intermediate states.
 * Runs every 15 minutes to enforce max TTL for each entity/state pair.
 *
 * Zombie States Monitored:
 * - Orders: pending (1h), paid (30min), paid exhausted (2h), submitted (7d),
 *           in_production (14d), requires_review (24h), shipped (30d)
 * - Products: publishing (1h), pending_review (7d)
 * - Agent sessions: queued (30min)
 * - Returns: pending (7d), approved (14d)
 *
 * Protected by Bearer token authentication.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()

  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, any> = {
    orders: {},
    products: {},
    agents: {},
    returns: {},
  }

  try {
    // =================================================================
    // ORDER ZOMBIE STATES
    // =================================================================

    // Order: pending > 1h
    const { data: pendingOrders } = await supabaseAdmin
      .from('orders')
      .select('id, status, created_at')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(50)

    results.orders.pending = {
      count: pendingOrders?.length || 0,
      action: 'alert_admin',
      message: `${pendingOrders?.length || 0} orders stuck in pending > 1h (payment may have failed)`,
    }

    // Order: paid > 30min (retry_count < 3)
    const { data: paidOrders } = await supabaseAdmin
      .from('orders')
      .select('id, status, updated_at, retry_count')
      .eq('status', 'paid')
      .lt('retry_count', 3)
      .lt('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(50)

    results.orders.paid_retry = {
      count: paidOrders?.length || 0,
      action: 'retry_printify_submission',
      message: `${paidOrders?.length || 0} paid orders need Printify retry`,
    }

    // Order: paid > 2h (retry_count >= 3) - exhausted retries
    const { data: exhaustedOrders } = await supabaseAdmin
      .from('orders')
      .select('id, status, updated_at, retry_count, total_cents')
      .eq('status', 'paid')
      .gte('retry_count', 3)
      .lt('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .limit(50)

    // Auto-refund exhausted orders
    let refundedCount = 0
    if (exhaustedOrders && exhaustedOrders.length > 0) {
      for (const order of exhaustedOrders) {
        // Call issue_refund_atomic function
        const { data: refundResult } = await supabaseAdmin
          .rpc('issue_refund_atomic', {
            p_order_id: order.id,
            p_refund_amount_cents: order.total_cents,
            p_refund_reason: 'Auto-refund: Printify submission failed after 3 retries',
          })

        if (refundResult) refundedCount++
      }
    }

    results.orders.paid_exhausted = {
      count: exhaustedOrders?.length || 0,
      refunded: refundedCount,
      action: 'auto_refund',
      message: `${refundedCount}/${exhaustedOrders?.length || 0} exhausted orders refunded`,
    }

    // Order: submitted > 7d
    const { data: submittedOrders } = await supabaseAdmin
      .from('orders')
      .select('id, status, updated_at')
      .eq('status', 'submitted')
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50)

    results.orders.submitted = {
      count: submittedOrders?.length || 0,
      action: 'alert_admin',
      message: `${submittedOrders?.length || 0} orders stuck in submitted > 7d`,
    }

    // Order: in_production > 14d
    const { data: productionOrders } = await supabaseAdmin
      .from('orders')
      .select('id, status, updated_at')
      .eq('status', 'in_production')
      .lt('updated_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50)

    results.orders.in_production = {
      count: productionOrders?.length || 0,
      action: 'alert_admin',
      message: `${productionOrders?.length || 0} orders in production > 14d`,
    }

    // Order: requires_review > 24h
    const { data: reviewOrders } = await supabaseAdmin
      .from('orders')
      .select('id, status, updated_at, total_cents')
      .eq('status', 'requires_review')
      .lt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50)

    // Auto-refund orders requiring review > 24h
    let reviewRefundedCount = 0
    if (reviewOrders && reviewOrders.length > 0) {
      for (const order of reviewOrders) {
        const { data: refundResult } = await supabaseAdmin
          .rpc('issue_refund_atomic', {
            p_order_id: order.id,
            p_refund_amount_cents: order.total_cents,
            p_refund_reason: 'Auto-refund: Order requires review for > 24h',
          })

        if (refundResult) reviewRefundedCount++
      }
    }

    results.orders.requires_review = {
      count: reviewOrders?.length || 0,
      refunded: reviewRefundedCount,
      action: 'auto_refund',
      message: `${reviewRefundedCount}/${reviewOrders?.length || 0} review orders refunded`,
    }

    // Order: shipped > 30d (auto-confirm delivery)
    const { data: shippedOrders } = await supabaseAdmin
      .from('orders')
      .select('id, status, updated_at')
      .eq('status', 'shipped')
      .lt('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50)

    // Auto-confirm delivery
    let confirmedCount = 0
    if (shippedOrders && shippedOrders.length > 0) {
      const { count } = await supabaseAdmin
        .from('orders')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .in('id', shippedOrders.map(o => o.id))
        .eq('status', 'shipped')

      confirmedCount = count || 0
    }

    results.orders.shipped = {
      count: shippedOrders?.length || 0,
      confirmed: confirmedCount,
      action: 'auto_confirm_delivery',
      message: `${confirmedCount}/${shippedOrders?.length || 0} shipped orders auto-confirmed as delivered`,
    }

    // =================================================================
    // PRODUCT ZOMBIE STATES
    // =================================================================

    // Product: publishing > 1h
    const { data: publishingProducts } = await supabaseAdmin
      .from('products')
      .select('id, status, updated_at')
      .eq('status', 'publishing')
      .lt('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(50)

    // Revert to draft
    let revertedCount = 0
    if (publishingProducts && publishingProducts.length > 0) {
      const { count } = await supabaseAdmin
        .from('products')
        .update({ status: 'draft' })
        .in('id', publishingProducts.map(p => p.id))
        .eq('status', 'publishing')

      revertedCount = count || 0
    }

    results.products.publishing = {
      count: publishingProducts?.length || 0,
      reverted: revertedCount,
      action: 'revert_to_draft',
      message: `${revertedCount}/${publishingProducts?.length || 0} stuck products reverted to draft`,
    }

    // Product: pending_review > 7d
    const { data: reviewProducts } = await supabaseAdmin
      .from('products')
      .select('id, status, updated_at')
      .eq('status', 'pending_review')
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50)

    results.products.pending_review = {
      count: reviewProducts?.length || 0,
      action: 'alert_admin',
      message: `${reviewProducts?.length || 0} products pending review > 7d`,
    }

    // =================================================================
    // AGENT ZOMBIE STATES
    // =================================================================

    // Agent: queued > 30min
    const { data: queuedAgents } = await supabaseAdmin
      .from('agent_sessions')
      .select('id, agent_name, status, created_at')
      .eq('status', 'queued')
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(50)

    // Mark as error and reschedule
    let rescheduledCount = 0
    if (queuedAgents && queuedAgents.length > 0) {
      const { count } = await supabaseAdmin
        .from('agent_sessions')
        .update({ status: 'error', error: 'Timeout: Queued > 30min' })
        .in('id', queuedAgents.map(a => a.id))
        .eq('status', 'queued')

      rescheduledCount = count || 0
    }

    results.agents.queued = {
      count: queuedAgents?.length || 0,
      rescheduled: rescheduledCount,
      action: 'mark_error_reschedule',
      message: `${rescheduledCount}/${queuedAgents?.length || 0} queued agents marked as error`,
    }

    // =================================================================
    // RETURN ZOMBIE STATES
    // =================================================================

    // Return: pending > 7d
    const { data: pendingReturns } = await supabaseAdmin
      .from('return_requests')
      .select('id, status, created_at')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50)

    results.returns.pending = {
      count: pendingReturns?.length || 0,
      action: 'alert_admin',
      message: `${pendingReturns?.length || 0} returns pending > 7d`,
    }

    // Return: approved > 14d
    const { data: approvedReturns } = await supabaseAdmin
      .from('return_requests')
      .select('id, status, updated_at')
      .eq('status', 'approved')
      .lt('updated_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50)

    results.returns.approved = {
      count: approvedReturns?.length || 0,
      action: 'alert_admin',
      message: `${approvedReturns?.length || 0} returns approved but not completed > 14d`,
    }

    // =================================================================
    // RECORD EXECUTION IN CRON_RUNS
    // =================================================================

    const duration = Date.now() - startTime
    await supabaseAdmin
      .from('cron_runs')
      .insert({
        cron_name: 'zombie-reaper',
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
        status: 'completed',
        duration_ms: duration,
      })

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    console.error('ZombieReaper cron error:', error)

    // Record failed execution
    await supabaseAdmin
      .from('cron_runs')
      .insert({
        cron_name: 'zombie-reaper',
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error_message: error instanceof Error ? error.message : String(error),
      })

    return NextResponse.json(
      {
        error: 'ZombieReaper failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
