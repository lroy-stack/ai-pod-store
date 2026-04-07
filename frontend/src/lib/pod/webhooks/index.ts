/**
 * Webhook infrastructure barrel export.
 *
 * createWebhookRouter() returns a fully configured router with all
 * event handlers registered. Used by the unified /api/webhooks/pod/[provider] route.
 */

import { WebhookRouter } from './webhook-router'
import { handleOrderCreated } from './handlers/order-created'
import { handleOrderShipped } from './handlers/order-shipped'
import { handleOrderDelivered } from './handlers/order-delivered'
import { handleOrderCancelled } from './handlers/order-cancelled'
import { handleOrderFailed } from './handlers/order-failed'
import { handleProductUpdated } from './handlers/product-updated'
import { handleProductDeleted } from './handlers/product-deleted'
import { handleStockUpdated } from './handlers/stock-updated'

/** Create and configure the webhook router with all handlers */
export function createWebhookRouter(): WebhookRouter {
  const router = new WebhookRouter()

  // Order events
  router.on('order.created', handleOrderCreated)
  router.on('order.updated', handleOrderCreated) // Log-only (same as created)
  router.on('order.shipped', handleOrderShipped)
  router.on('order.delivered', handleOrderDelivered)
  router.on('order.cancelled', handleOrderCancelled)
  router.on('order.failed', handleOrderFailed)

  // Product events
  router.on('product.created', handleProductUpdated)
  router.on('product.updated', handleProductUpdated)
  router.on('product.publish_succeeded', handleProductUpdated)
  router.on('product.deleted', handleProductDeleted)

  // Stock events
  router.on('stock.updated', handleStockUpdated)

  return router
}

// Re-exports
export { WebhookRouter } from './webhook-router'
export type { WebhookHandler } from './webhook-router'
