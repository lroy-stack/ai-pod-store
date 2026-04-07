/**
 * WebhookRouter — Routes normalized webhook events to registered handlers.
 *
 * Provider-agnostic: works with any NormalizedWebhookEvent regardless of
 * whether it came from Printify, Printful, or a future provider.
 */

import type { NormalizedWebhookEvent } from '../models'
import type { SupabaseClient } from '@supabase/supabase-js'

export type WebhookHandler = (
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
) => Promise<void>

export class WebhookRouter {
  private handlers = new Map<string, WebhookHandler>()

  /** Register a handler for a specific event type */
  on(eventType: string, handler: WebhookHandler): void {
    this.handlers.set(eventType, handler)
  }

  /** Route an event to its registered handler */
  async route(event: NormalizedWebhookEvent, supabase: SupabaseClient): Promise<void> {
    const handler = this.handlers.get(event.type)
    if (handler) {
      await handler(event, supabase)
    } else {
      console.log(`[webhook-router] No handler for event type: ${event.type}`)
    }
  }

  /** Check if a handler is registered for the given event type */
  has(eventType: string): boolean {
    return this.handlers.has(eventType)
  }
}
