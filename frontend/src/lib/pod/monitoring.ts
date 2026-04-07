/**
 * POD Monitoring — structured logging and alerting for sync, webhooks, and margin fixes.
 *
 * Built on top of the existing Pino logger (lib/logger.ts).
 * Alert thresholds trigger Telegram notifications via /api/admin/alert.
 */

import { logInfo, logWarn, logError } from '@/lib/logger'
import type { SyncReport, SyncResult } from './sync/types'
import type { NormalizedWebhookEvent } from './models'

// ─── Sync Lifecycle Logging ─────────────────────────────────

export function logSyncStart(provider: string): void {
  logInfo('pod-sync: cycle started', { provider })
}

export function logSyncResult(result: SyncResult, provider: string): void {
  if (result.error) {
    logError('pod-sync: product sync failed', {
      provider,
      productId: result.providerProductId,
      error: result.error,
    })
  } else {
    logInfo('pod-sync: product synced', {
      provider,
      productId: result.providerProductId,
      action: result.action,
    })
  }
}

export function logSyncReport(report: SyncReport): void {
  logInfo('pod-sync: cycle completed', {
    providerTotal: report.providerTotal,
    supabaseTotal: report.supabaseTotal,
    created: report.created,
    updated: report.updated,
    deleted: report.deleted,
    marginFixed: report.marginFixed,
    errors: report.errors.length,
    durationMs: report.durationMs,
  })
}

// ─── Margin Fix Logging ─────────────────────────────────────

export function logMarginFix(
  productId: string,
  before: number,
  after: number,
  costCents: number,
): void {
  logWarn('pod-sync: margin corrected', {
    productId,
    priceBefore: before,
    priceAfter: after,
    costCents,
    marginBefore: before > 0 ? `${Math.round(((before - costCents) / before) * 100)}%` : '0%',
    marginAfter: after > 0 ? `${Math.round(((after - costCents) / after) * 100)}%` : '0%',
  })
}

// ─── Webhook Logging ────────────────────────────────────────

export function logWebhookReceived(event: NormalizedWebhookEvent): void {
  logInfo('pod-webhook: received', {
    type: event.type,
    provider: event.provider,
    resourceId: event.resourceId,
    eventId: event.eventId,
  })
}

export function logWebhookProcessed(event: NormalizedWebhookEvent, durationMs: number): void {
  logInfo('pod-webhook: processed', {
    type: event.type,
    provider: event.provider,
    resourceId: event.resourceId,
    durationMs,
  })
}

export function logWebhookFailed(event: NormalizedWebhookEvent, error: unknown): void {
  logError('pod-webhook: failed', {
    type: event.type,
    provider: event.provider,
    resourceId: event.resourceId,
    error: error instanceof Error ? error.message : String(error),
  })
}

// ─── Divergence Logging ─────────────────────────────────────

export function logDivergenceReport(result: {
  checked: number
  divergent: number
  details: string[]
}): void {
  if (result.divergent > 0) {
    logWarn('pod-sync: divergence detected', {
      checked: result.checked,
      divergent: result.divergent,
      details: result.details.slice(0, 5), // Limit log payload
    })
  } else {
    logInfo('pod-sync: no divergence', { checked: result.checked })
  }
}

// ─── Alert on Critical Errors ───────────────────────────────

const ALERT_THRESHOLD_ERRORS = 5
const ALERT_THRESHOLD_FAILURE_RATE = 0.5

/**
 * Sends a Telegram alert if the sync report has critical error levels.
 * Uses the existing /api/admin/alert endpoint.
 */
export async function alertOnSyncError(report: SyncReport): Promise<void> {
  const totalProcessed = report.created + report.updated + report.deleted
  const failureRate = totalProcessed > 0
    ? report.errors.length / (totalProcessed + report.errors.length)
    : report.errors.length > 0 ? 1 : 0

  const shouldAlert = report.errors.length >= ALERT_THRESHOLD_ERRORS
    || failureRate >= ALERT_THRESHOLD_FAILURE_RATE

  if (!shouldAlert) return

  const message = [
    `POD Sync Alert`,
    `Errors: ${report.errors.length}`,
    `Failure rate: ${Math.round(failureRate * 100)}%`,
    `Created: ${report.created}, Updated: ${report.updated}, Deleted: ${report.deleted}`,
    `Duration: ${report.durationMs}ms`,
    report.errors.slice(0, 3).join('\n'),
  ].join('\n')

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    await fetch(`${baseUrl}/api/admin/alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN || ''}`,
      },
      body: JSON.stringify({
        type: 'pod_sync_error',
        message,
        severity: 'high',
      }),
    })
  } catch (e) {
    logError('pod-sync: failed to send alert', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
