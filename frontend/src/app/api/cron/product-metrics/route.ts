import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyCronSecret } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/product-metrics
 * Daily ETL job that computes product-level and portfolio-level analytics.
 *
 * 1. Calls compute_daily_product_metrics(yesterday) — aggregates order_items
 * 2. Calls compute_portfolio_metrics(yesterday) — store-wide health snapshot
 *
 * Intended to be called daily at ~01:00 UTC by Vercel Cron or external scheduler.
 * Protected by Bearer token authentication.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (timing-safe)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const targetDate = yesterday.toISOString().split('T')[0] // YYYY-MM-DD

  const results: Record<string, string> = {}
  const startedAt = new Date().toISOString()

  try {
    // 1. Compute daily product metrics
    const { error: productError } = await supabaseAdmin.rpc(
      'compute_daily_product_metrics',
      { target_date: targetDate }
    )

    if (productError) {
      console.error('compute_daily_product_metrics error:', productError)
      results.productMetrics = `Error: ${productError.message}`
    } else {
      // Count how many rows were upserted
      const { count } = await supabaseAdmin
        .from('product_daily_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('metric_date', targetDate)

      results.productMetrics = `Computed metrics for ${count || 0} products on ${targetDate}`
    }

    // 2. Compute portfolio metrics
    const { error: portfolioError } = await supabaseAdmin.rpc(
      'compute_portfolio_metrics',
      { target_date: targetDate }
    )

    if (portfolioError) {
      console.error('compute_portfolio_metrics error:', portfolioError)
      results.portfolioMetrics = `Error: ${portfolioError.message}`
    } else {
      // Verify the row was created
      const { data: portfolioRow } = await supabaseAdmin
        .from('daily_portfolio_metrics')
        .select('total_orders, total_revenue_cents, active_products, zombie_products')
        .eq('date', targetDate)
        .single()

      if (portfolioRow) {
        results.portfolioMetrics = [
          `Date: ${targetDate}`,
          `Orders: ${portfolioRow.total_orders}`,
          `Revenue: $${(portfolioRow.total_revenue_cents / 100).toFixed(2)}`,
          `Active products: ${portfolioRow.active_products}`,
          `Zombie products: ${portfolioRow.zombie_products}`,
        ].join(', ')
      } else {
        results.portfolioMetrics = `Computed portfolio metrics for ${targetDate}`
      }
    }

    const completedAt = new Date().toISOString()
    console.log('product-metrics cron completed:', JSON.stringify({ startedAt, completedAt, results }))

    return NextResponse.json({
      success: true,
      targetDate,
      startedAt,
      completedAt,
      results,
    })
  } catch (error) {
    console.error('Product metrics cron error:', error)
    return NextResponse.json(
      {
        error: 'Product metrics ETL failed',
        details: error instanceof Error ? error.message : String(error),
        targetDate,
        results,
      },
      { status: 500 }
    )
  }
}
