/**
 * Order Details API
 *
 * GET /api/orders/:id
 * Returns order details with items. Requires auth + ownership check.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let user
    try {
      user = await requireAuth(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    const { id } = await params

    // Build query with ownership check in DB (prevents IDOR by never loading unauthorized data)
    // Admins (role='admin') can see all orders; regular users can only see their own
    let query = supabase
      .from('orders')
      .select('id, status, total_cents, currency, created_at, paid_at, shipped_at, delivered_at, tracking_number, tracking_url, carrier, customer_email, shipping_address, locale, gift_message, payment_method, refunded_at, refund_amount_cents, refund_reason, admin_notes')
      .eq('id', id)

    if (user.role !== 'admin') {
      query = query.eq('user_id', user.id)
    }

    const { data: order, error: orderError } = await query.single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Fetch order items with product details
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        product:products!order_items_product_id_fkey (
          id,
          title,
          base_price_cents,
          currency,
          images
        ),
        variant:product_variants!order_items_variant_id_fkey (
          id,
          size,
          color,
          sku
        )
      `)
      .eq('order_id', id)

    if (itemsError) {
      console.error('Error fetching order items:', itemsError)
    }

    // Strip admin-only fields for non-admin users
    const safeOrder = user.role === 'admin' ? order : (() => {
      const { admin_notes, ...rest } = order
      return rest
    })()

    return NextResponse.json({
      order: safeOrder,
      items: items || [],
    })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
