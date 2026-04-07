/**
 * Printful-specific constants.
 */

import type { WebhookEventType } from '../models'

export const PRINTFUL_API_BASE = 'https://api.printful.com'
export const PRINTFUL_CATALOG_TTL_MS = 10 * 60 * 1000 // 10 minutes
export const PRINTFUL_RATE_LIMIT_PER_MIN = 120
export const PRINTFUL_RATE_LIMIT_WINDOW_MS = 60 * 1000

/** Printful order status to canonical status */
export const PRINTFUL_ORDER_STATUS_MAP: Record<string, string> = {
  draft: 'draft',
  failed: 'failed',
  pending: 'pending',
  canceled: 'cancelled',
  onhold: 'pending',
  inprocess: 'in_production',
  partial: 'shipped',
  fulfilled: 'shipped',
  archived: 'delivered',
}

/** Printful webhook event types mapped to canonical */
export const PRINTFUL_EVENT_MAP: Record<string, WebhookEventType> = {
  package_shipped: 'order.shipped',
  package_returned: 'order.cancelled',
  order_created: 'order.created',
  order_updated: 'order.updated',
  order_failed: 'order.failed',
  order_canceled: 'order.cancelled',
  order_put_hold: 'order.updated',
  order_remove_hold: 'order.updated',
  product_synced: 'product.created',
  product_updated: 'product.updated',
  product_deleted: 'product.deleted',
  stock_updated: 'stock.updated',
}

/** Printify position names to Printful placement names */
export const POSITION_MAP: Record<string, string> = {
  front: 'front',
  back: 'back',
  neck_outer: 'label_outside',
  sleeve: 'sleeve_left',
  sleeve_left: 'sleeve_left',
  sleeve_right: 'sleeve_right',
  embroidery_front: 'embroidery_front',
  embroidery_back: 'embroidery_back',
}

/** All Printful webhook event types we register for */
export const PRINTFUL_WEBHOOK_EVENTS = Object.keys(PRINTFUL_EVENT_MAP)
