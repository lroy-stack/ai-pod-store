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

    // Fetch order with ownership check
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Ownership check: user can only view their own orders (admins see all)
    if (order.user_id !== user.id && user.role !== 'admin') {
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

    return NextResponse.json({
      order,
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
