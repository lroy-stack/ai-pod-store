/**
 * Unified POD Webhook Endpoint
 *
 * POST /api/webhooks/pod/[provider]
 * Dynamic route where [provider] = 'printify' | 'printful'
 *
 * Flow:
 * 1. Extract provider from URL path
 * 2. Read raw body
 * 3. Initialize and lookup provider
 * 4. Verify webhook signature (HMAC for Printify, query secret for Printful)
 * 5. Normalize event to canonical format
 * 6. Write audit log
 * 7. Route to appropriate handler
 * 8. Always return 200 after verification (prevents provider retries)
 */

import { NextRequest, NextResponse } from 'next/server'
import { initializeProviders, getProviderById } from '@/lib/pod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createWebhookRouter } from '@/lib/pod/webhooks'

// Create a singleton router (all handlers are stateless, safe to reuse)
const webhookRouter = createWebhookRouter()

/** Map of provider IDs to their webhook signature header names */
const SIGNATURE_HEADERS: Record<string, string> = {
  printify: 'x-printify-hmac-sha256',
  printful: '', // Printful uses query param ?secret=, not a header
}

/** Known provider IDs */
const KNOWN_PROVIDERS = new Set(['printify', 'printful'])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params

  // Validate provider ID
  if (!KNOWN_PROVIDERS.has(providerId)) {
    return NextResponse.json(
      { error: `Unknown provider: ${providerId}` },
      { status: 404 },
    )
  }

  // Read raw body for signature verification
  const body = await req.text()

  // Initialize all configured providers
  initializeProviders()

  // Get the provider instance
  let providerInstance
  try {
    providerInstance = getProviderById(providerId)
  } catch {
    console.error(`[webhook:${providerId}] Provider not configured`)
    return NextResponse.json(
      { error: `Provider ${providerId} is not configured` },
      { status: 500 },
    )
  }

  // Extract signature based on provider type
  let signature: string
  if (providerId === 'printful') {
    // Printful uses ?secret= query parameter
    signature = req.nextUrl.searchParams.get('secret') || ''
  } else {
    // Printify and others use header-based signatures
    const headerName = SIGNATURE_HEADERS[providerId] || ''
    signature = req.headers.get(headerName) || ''
  }

  if (!signature) {
    console.error(`[webhook:${providerId}] Missing webhook signature`)
    return NextResponse.json(
      { error: 'Missing webhook signature' },
      { status: 401 },
    )
  }

  // Verify the webhook signature
  const isValid = providerInstance.verifyWebhook(body, signature)
  if (!isValid) {
    console.error(`[webhook:${providerId}] Webhook signature verification failed`)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 },
    )
  }

  // Parse and normalize the event
  let rawEvent: unknown
  try {
    rawEvent = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let event
  try {
    event = providerInstance.normalizeEvent(rawEvent)
  } catch (error) {
    console.error(`[webhook:${providerId}] Failed to normalize event:`, error)
    return NextResponse.json(
      { error: 'Failed to normalize event' },
      { status: 400 },
    )
  }

  // Write audit log entry for the raw event
  try {
    await supabaseAdmin.from('audit_log').insert({
      actor_type: 'webhook',
      actor_id: `${providerId}_webhook`,
      action: `webhook_received:${event.type}`,
      resource_type: 'webhook',
      resource_id: event.eventId || event.resourceId || 'unknown',
      changes: { normalized_type: event.type },
      metadata: {
        provider: providerId,
        resource_id: event.resourceId,
        event_id: event.eventId,
      },
    })
  } catch (auditError) {
    // Audit log failure is not critical — continue processing
    console.error(`[webhook:${providerId}] Failed to write audit log:`, auditError)
  }

  // Route the event to its handler
  try {
    await webhookRouter.route(event, supabaseAdmin)
  } catch (error) {
    console.error(`[webhook:${providerId}] Error handling event ${event.type}:`, error)

    // Persist to dead letter queue for later retry/investigation
    await supabaseAdmin.from('webhook_dead_letters').insert({
      provider: providerId,
      event_type: event.type,
      event_id: event.eventId,
      resource_id: event.resourceId,
      payload: rawEvent as any,
      error: error instanceof Error ? error.message : String(error),
    }).then(null, (dlqError: unknown) => {
      console.error(`[webhook:${providerId}] Failed to write DLQ:`, dlqError)
    })

    // Return 200 to prevent provider from retrying — error persisted in DLQ
    return NextResponse.json({ received: true, error: 'Processing error' })
  }

  return NextResponse.json({ received: true })
}
