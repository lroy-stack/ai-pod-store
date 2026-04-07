// @vitest-environment node
/**
 * Webhook Verification — Unit Tests
 *
 * Tests verifyPrintifyWebhook (HMAC-SHA256) and verifyPrintfulWebhook
 * (timing-safe string comparison). Requires node environment for crypto.
 */

import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyPrintifyWebhook } from '@/lib/pod/printify/webhook-verifier'
import { verifyPrintfulWebhook } from '@/lib/pod/printful/webhook-verifier'

// ─── verifyPrintifyWebhook ──────────────────────────────────

describe('verifyPrintifyWebhook', () => {
  const secret = 'test-webhook-secret-123'
  const body = '{"type":"order:created","resource":{"id":"abc"}}'

  function makeSignature(rawBody: string, secretKey: string): string {
    return createHmac('sha256', secretKey)
      .update(rawBody, 'utf8')
      .digest('base64')
  }

  it('returns true for valid HMAC-SHA256 signature', () => {
    const sig = makeSignature(body, secret)
    expect(verifyPrintifyWebhook(body, sig, secret)).toBe(true)
  })

  it('returns false for invalid signature', () => {
    expect(verifyPrintifyWebhook(body, 'invalid-sig', secret)).toBe(false)
  })

  it('returns false for wrong secret', () => {
    const sig = makeSignature(body, secret)
    expect(verifyPrintifyWebhook(body, sig, 'wrong-secret')).toBe(false)
  })

  it('returns false for empty signature', () => {
    expect(verifyPrintifyWebhook(body, '', secret)).toBe(false)
  })

  it('returns false for empty secret', () => {
    const sig = makeSignature(body, secret)
    expect(verifyPrintifyWebhook(body, sig, '')).toBe(false)
  })

  it('returns false for tampered body', () => {
    const sig = makeSignature(body, secret)
    expect(verifyPrintifyWebhook(body + 'x', sig, secret)).toBe(false)
  })

  it('handles different body content correctly', () => {
    const body2 = '{"type":"product:updated"}'
    const sig = makeSignature(body2, secret)
    expect(verifyPrintifyWebhook(body2, sig, secret)).toBe(true)
  })
})

// ─── verifyPrintfulWebhook ──────────────────────────────────

describe('verifyPrintfulWebhook', () => {
  const secret = 'my-printful-secret-token'

  it('returns true when signature matches secret (timing-safe)', () => {
    expect(verifyPrintfulWebhook('any-body', secret, secret)).toBe(true)
  })

  it('returns false when signature does not match', () => {
    expect(verifyPrintfulWebhook('any-body', 'wrong-token', secret)).toBe(false)
  })

  it('returns false for empty signature', () => {
    expect(verifyPrintfulWebhook('any-body', '', secret)).toBe(false)
  })

  it('returns false for empty secret', () => {
    expect(verifyPrintfulWebhook('any-body', secret, '')).toBe(false)
  })

  it('ignores rawBody (only compares signature vs secret)', () => {
    // Printful verifies via query-string secret, not body HMAC
    expect(verifyPrintfulWebhook('', secret, secret)).toBe(true)
    expect(verifyPrintfulWebhook('completely different body', secret, secret)).toBe(true)
  })

  it('returns false for different-length strings', () => {
    expect(verifyPrintfulWebhook('body', 'short', 'much-longer-secret')).toBe(false)
  })
})
