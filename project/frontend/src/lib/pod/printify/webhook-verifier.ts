/**
 * Printify webhook signature verification.
 * HMAC-SHA256 with timing-safe comparison.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyPrintifyWebhook(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false

  try {
    const expected = createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64')

    const sigBuf = Buffer.from(signature, 'base64')
    const expBuf = Buffer.from(expected, 'base64')

    if (sigBuf.length !== expBuf.length) return false
    return timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}
