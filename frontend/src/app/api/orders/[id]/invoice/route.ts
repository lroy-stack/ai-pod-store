/**
 * Order Invoice API
 *
 * GET /api/orders/:id/invoice
 * Returns invoice data (Stripe invoice URL or downloadable invoice).
 * Requires auth + ownership check.
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
      .select('id, status, total_cents, currency, created_at, customer_email, stripe_payment_intent_id, shipping_address')
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

    // For orders with Stripe payment intent, we can provide invoice data
    if (order.stripe_payment_intent_id) {
      // In a production environment, you would:
      // 1. Use Stripe API to fetch the invoice: stripe.invoices.retrieve()
      // 2. Get the hosted invoice URL: invoice.hosted_invoice_url
      //
      // For now, we return structured invoice data that can be used
      // to display an invoice or link to Stripe's hosted invoice page

      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          product:products!order_items_product_id_fkey (
            title
          )
        `)
        .eq('order_id', id)

      if (itemsError) {
        console.error('Error fetching order items:', itemsError)
      }

      // Calculate line items for invoice
      const lineItems = (items || []).map((item: any) => ({
        description: item.product?.title || 'Product',
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        total_cents: item.unit_price_cents * item.quantity,
      }))

      return NextResponse.json({
        invoice_type: 'stripe',
        order_id: order.id,
        order_number: order.id.split('-')[0], // First segment as order number
        date: order.created_at,
        status: order.status,
        customer_email: order.customer_email || user.email,
        line_items: lineItems,
        subtotal_cents: lineItems.reduce((sum: number, item: any) => sum + item.total_cents, 0),
        total_cents: order.total_cents,
        currency: order.currency?.toUpperCase() || 'EUR',
        payment_intent_id: order.stripe_payment_intent_id,
        // In production, this would be the actual Stripe hosted invoice URL
        // hosted_invoice_url: invoice.hosted_invoice_url
        stripe_dashboard_url: `https://dashboard.stripe.com/payments/${order.stripe_payment_intent_id}`,
      })
    }

    // For orders without Stripe payment (e.g., free orders, test orders)
    // Return basic invoice data
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        product:products!order_items_product_id_fkey (
          title
        )
      `)
      .eq('order_id', id)

    if (itemsError) {
      console.error('Error fetching order items:', itemsError)
    }

    const lineItems = (items || []).map((item: any) => ({
      description: item.product?.title || 'Product',
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      total_cents: item.unit_price_cents * item.quantity,
    }))

    return NextResponse.json({
      invoice_type: 'basic',
      order_id: order.id,
      order_number: order.id.split('-')[0],
      date: order.created_at,
      status: order.status,
      customer_email: order.customer_email || user.email,
      line_items: lineItems,
      subtotal_cents: lineItems.reduce((sum: number, item: any) => sum + item.total_cents, 0),
      total_cents: order.total_cents,
      currency: order.currency?.toUpperCase() || 'EUR',
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
