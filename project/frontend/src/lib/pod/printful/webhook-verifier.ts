/**
 * Printful webhook verification.
 *
 * Printful does NOT use HMAC signatures. Instead, webhook authenticity is
 * verified by including a secret token in the webhook URL query string:
 *   https://example.com/webhooks/printful?secret={PRINTFUL_WEBHOOK_SECRET}
 *
 * The `signature` parameter receives the query-string secret value,
 * and `secret` is the expected value from env vars.
 * `rawBody` is unused but kept for interface compatibility with PODWebhookProvider.
 */

import { timingSafeEqual } from 'node:crypto'

export function verifyPrintfulWebhook(
  _rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false

  try {
    const sigBuf = Buffer.from(signature, 'utf8')
    const secBuf = Buffer.from(secret, 'utf8')

    if (sigBuf.length !== secBuf.length) return false
    return timingSafeEqual(sigBuf, secBuf)
  } catch {
    return false
  }
}
