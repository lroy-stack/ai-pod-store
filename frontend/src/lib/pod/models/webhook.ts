/**
 * Webhook models — normalized event types across providers.
 */

export type WebhookEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.submitted'
  | 'order.in_production'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.failed'
  | 'order.refunded'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'product.publish_started'
  | 'product.publish_succeeded'
  | 'stock.updated'

export interface NormalizedWebhookEvent {
  type: WebhookEventType
  provider: string
  eventId: string
  resourceId: string
  timestamp: string
  data: Record<string, unknown>
  _raw: unknown
}
