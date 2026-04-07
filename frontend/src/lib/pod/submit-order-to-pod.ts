/**
 * submitOrderToPOD — Reusable function to submit an order to the POD provider.
 *
 * Used by:
 * - checkout-completed.ts (first attempt after payment)
 * - retry-pod-orders cron (re-submission after failure)
 *
 * Fetches order + items + shipping from DB, builds provider line items,
 * calls provider.createOrder() + provider.submitForProduction().
 */

import { initializeProviders, getProvider } from '@/lib/pod'
import { canonicalAddressFromStripe } from '@/lib/pod/printify/mapper'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface SubmitOrderResult {
  success: boolean
  externalOrderId?: string
  error?: string
}

export async function submitOrderToPOD(orderId: string): Promise<SubmitOrderResult> {
  // 1. Fetch order with items and shipping address
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, customer_email, shipping_address, currency, locale')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return { success: false, error: `Order not found: ${orderId}` }
  }

  // 2. Fetch order items
  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('id, product_id, variant_id, quantity, composition_id')
    .eq('order_id', orderId)

  if (itemsError || !orderItems || orderItems.length === 0) {
    return { success: false, error: 'No order items found' }
  }

  // 3. Parse shipping address from order JSONB
  const shippingAddress = order.shipping_address as Record<string, string> | null
  if (!shippingAddress) {
    return { success: false, error: 'Shipping address not found in order' }
  }

  // 4. Fetch product provider IDs
  const productIds = orderItems.map(item => item.product_id)
  const variantIds = orderItems.map(item => item.variant_id).filter(Boolean)

  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, provider_product_id')
    .in('id', productIds)

  const { data: variants } = await supabaseAdmin
    .from('product_variants')
    .select('id, external_variant_id')
    .in('id', variantIds)

  const productMap = new Map(products?.map(p => [p.id, p.provider_product_id]) || [])
  const variantMap = new Map(variants?.map(v => [v.id, v.external_variant_id]) || [])

  // 5. Guard: verify all items have provider variant mappings
  const itemsMissing = orderItems.filter(item => {
    const pvId = variantMap.get(item.variant_id)
    return !pvId || pvId === '0'
  })

  if (itemsMissing.length > 0) {
    return { success: false, error: `${itemsMissing.length} items missing provider variant mapping` }
  }

  // 6. Build provider line items
  const providerLineItems = orderItems
    .filter(item => {
      const providerProductId = productMap.get(item.product_id)
      const providerVariantId = variantMap.get(item.variant_id)
      return providerProductId && providerVariantId
    })
    .map(item => ({
      productExternalId: productMap.get(item.product_id)!,
      variantExternalId: variantMap.get(item.variant_id)!,
      quantity: item.quantity,
    }))

  if (providerLineItems.length === 0) {
    return { success: false, error: 'No valid provider line items' }
  }

  // 7. Initialize provider and submit
  initializeProviders()
  const provider = getProvider()

  const canonicalAddress = canonicalAddressFromStripe(shippingAddress, order.customer_email || '')

  const podOrder = await provider.createOrder({
    internalOrderId: order.id,
    label: `Order ${order.id.slice(0, 8)}`,
    lineItems: providerLineItems,
    shippingAddress: canonicalAddress,
    suppressShippingNotification: false,
  })

  // 8. Update order with external ID
  await supabaseAdmin
    .from('orders')
    .update({
      external_order_id: podOrder.externalId,
      pod_provider: 'printful',
      status: 'submitted',
      pod_last_attempt_at: new Date().toISOString(),
      pod_error: null,
    })
    .eq('id', order.id)

  // 9. Submit for production
  await provider.submitForProduction(podOrder.externalId)

  return { success: true, externalOrderId: podOrder.externalId }
}
