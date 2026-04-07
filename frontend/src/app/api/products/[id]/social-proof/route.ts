import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/products/[id]/social-proof
 *
 * Returns social proof data: views today + orders this week.
 * Used by SocialProofIndicator component.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params

    if (!productId) {
      return NextResponse.json({ viewsToday: 0, ordersThisWeek: 0 })
    }

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Fetch today's views
    const { data: todayData } = await supabaseAdmin
      .from('product_daily_metrics')
      .select('views')
      .eq('product_id', productId)
      .eq('metric_date', today)
      .single()

    // Fetch this week's orders
    const { data: weekData } = await supabaseAdmin
      .from('product_daily_metrics')
      .select('orders')
      .eq('product_id', productId)
      .gte('metric_date', weekAgo)

    const viewsToday = todayData?.views || 0
    const ordersThisWeek = (weekData || []).reduce((sum, row) => sum + (row.orders || 0), 0)

    return NextResponse.json({
      viewsToday,
      ordersThisWeek,
      sellingFast: ordersThisWeek > 5,
    })
  } catch (error) {
    console.error('Social proof error:', error)
    return NextResponse.json({ viewsToday: 0, ordersThisWeek: 0, sellingFast: false })
  }
}
