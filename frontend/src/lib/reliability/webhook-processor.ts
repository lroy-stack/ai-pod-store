/**
 * WebhookProcessor — Deduplication module for webhook events
 *
 * Prevents duplicate processing of webhook events by tracking them in the
 * processed_events table. Uses INSERT ... ON CONFLICT to atomically check
 * for duplicates and insert new events.
 *
 * @module reliability/webhook-processor
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface ProcessEventResult {
  processed: boolean
  eventId?: string
  error?: string
}

/**
 * Process a webhook event with deduplication
 *
 * @param provider - Webhook provider (e.g., 'stripe', 'printify')
 * @param eventId - Unique event identifier from the provider
 * @param eventType - Type of event (e.g., 'payment_intent.succeeded')
 * @param handler - Async function to execute if event is not a duplicate
 * @returns Promise<ProcessEventResult> - {processed: true} if handler executed, {processed: false} if duplicate
 *
 * @example
 * ```typescript
 * const result = await processEvent(
 *   'stripe',
 *   'evt_1234567890',
 *   'payment_intent.succeeded',
 *   async () => {
 *     await handlePayment(event)
 *   }
 * )
 * if (result.processed) {
 *   console.log('Event processed successfully')
 * } else {
 *   console.log('Event was a duplicate, skipped')
 * }
 * ```
 */
export async function processEvent(
  provider: string,
  eventId: string,
  eventType: string,
  handler: () => Promise<void>
): Promise<ProcessEventResult> {
  try {
    // Try to insert the event record
    // ON CONFLICT DO NOTHING means if (provider, event_id) already exists,
    // the insert is silently skipped
    const { data, error } = await supabaseAdmin
      .from('processed_events')
      .insert({
        provider,
        event_id: eventId,
        event_type: eventType,
        processed_at: new Date().toISOString(),
      })
      .select('id')

    if (error) {
      // Check if it's a conflict/duplicate error (UNIQUE constraint violation)
      // PostgreSQL error code 23505 = unique_violation
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        // Event already processed - return without executing handler
        return {
          processed: false,
          eventId,
        }
      }

      // Other database error
      console.error('[WebhookProcessor] Database error:', error)
      return {
        processed: false,
        error: error.message,
      }
    }

    // If we got data back, the insert succeeded (new event)
    if (data && data.length > 0) {
      // Execute the handler
      try {
        await handler()

        // Update status_code on success
        await supabaseAdmin
          .from('processed_events')
          .update({ status_code: 200 })
          .eq('id', data[0].id)

        return {
          processed: true,
          eventId,
        }
      } catch (handlerError: any) {
        // Handler failed - update status_code
        console.error('[WebhookProcessor] Handler error:', handlerError)

        await supabaseAdmin
          .from('processed_events')
          .update({ status_code: 500 })
          .eq('id', data[0].id)

        return {
          processed: false,
          error: handlerError?.message || 'Handler execution failed',
        }
      }
    }

    // No data returned and no error - this shouldn't happen but treat as duplicate
    return {
      processed: false,
      eventId,
    }
  } catch (err: any) {
    console.error('[WebhookProcessor] Unexpected error:', err)
    return {
      processed: false,
      error: err?.message || 'Unexpected error',
    }
  }
}

/**
 * Check if an event has already been processed (read-only check)
 *
 * @param provider - Webhook provider
 * @param eventId - Event identifier
 * @returns Promise<boolean> - true if event exists in processed_events
 */
export async function isEventProcessed(
  provider: string,
  eventId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('processed_events')
      .select('id')
      .eq('provider', provider)
      .eq('event_id', eventId)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[WebhookProcessor] Check error:', error)
      return false
    }

    return data !== null
  } catch (err) {
    console.error('[WebhookProcessor] Unexpected check error:', err)
    return false
  }
}
