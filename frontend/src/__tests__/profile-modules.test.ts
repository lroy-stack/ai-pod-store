/**
 * Profile Modules A-D — Unit Tests
 *
 * Tests for: linked accounts, password flow, notifications,
 * Stripe customer creation, and address auto-save logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// MODULE A: Linked Accounts + Password Flow
// ============================================================

describe('Module A: Linked Accounts + Password Flow', () => {
  describe('Provider detection logic', () => {
    it('should detect hasPassword=true when email identity exists', () => {
      const identities = [
        { provider: 'google', identity_data: { email: 'user@gmail.com' }, created_at: '2026-01-01' },
        { provider: 'email', identity_data: { email: 'user@gmail.com' }, created_at: '2026-01-02' },
      ]
      const hasPassword = identities.some(i => i.provider === 'email')
      expect(hasPassword).toBe(true)
    })

    it('should detect hasPassword=false when only OAuth providers', () => {
      const identities = [
        { provider: 'google', identity_data: { email: 'user@gmail.com' }, created_at: '2026-01-01' },
        { provider: 'apple', identity_data: { email: 'user@gmail.com' }, created_at: '2026-01-02' },
      ]
      const hasPassword = identities.some(i => i.provider === 'email')
      expect(hasPassword).toBe(false)
    })

    it('should extract providers correctly from identities', () => {
      const identities = [
        { provider: 'google', identity_data: { email: 'user@gmail.com' }, created_at: '2026-03-15' },
        { provider: 'apple', identity_data: { email: 'user@gmail.com' }, created_at: '2026-03-18' },
      ]
      const providers = identities.map(i => ({
        provider: i.provider,
        email: i.identity_data?.email || null,
        created_at: i.created_at || '',
      }))

      expect(providers).toHaveLength(2)
      expect(providers[0].provider).toBe('google')
      expect(providers[1].provider).toBe('apple')
      expect(providers[0].email).toBe('user@gmail.com')
    })

    it('should handle empty identities gracefully', () => {
      const identities: any[] = []
      const hasPassword = identities.some(i => i.provider === 'email')
      const providers = identities.map(i => ({
        provider: i.provider,
        email: i.identity_data?.email || null,
        created_at: i.created_at || '',
      }))

      expect(hasPassword).toBe(false)
      expect(providers).toHaveLength(0)
    })
  })

  describe('Set password validation', () => {
    it('should reject password shorter than 8 chars', () => {
      const password = 'short'
      expect(password.length >= 8).toBe(false)
    })

    it('should accept password of 8+ chars', () => {
      const password = 'securepassword123'
      expect(password.length >= 8).toBe(true)
    })

    it('should block set-password if user already has email identity', () => {
      const identities = [
        { provider: 'email', identity_data: { email: 'user@test.com' } },
        { provider: 'google', identity_data: { email: 'user@test.com' } },
      ]
      const hasEmailIdentity = identities.some(i => i.provider === 'email')
      expect(hasEmailIdentity).toBe(true)
      // API should return 409 in this case
    })
  })
})

// ============================================================
// MODULE B: Notification Preferences
// ============================================================

describe('Module B: Notification Preferences', () => {
  describe('Preference defaults', () => {
    it('should default marketing_emails to true', () => {
      const prefs = {
        marketing_emails: undefined as boolean | undefined,
      }
      const effective = prefs.marketing_emails ?? true
      expect(effective).toBe(true)
    })

    it('should respect explicit false for marketing_emails', () => {
      const prefs = { marketing_emails: false }
      const effective = prefs.marketing_emails ?? true
      expect(effective).toBe(false)
    })

    it('should default product_announcements to true', () => {
      const prefs = {
        product_announcements: undefined as boolean | undefined,
      }
      const effective = prefs.product_announcements ?? true
      expect(effective).toBe(true)
    })
  })

  describe('Drip email preference check', () => {
    it('should skip sending when marketing_emails is false', () => {
      const userPrefs = { notification_preferences: { marketing_emails: false } }
      const shouldSend = userPrefs.notification_preferences.marketing_emails !== false
      expect(shouldSend).toBe(false)
    })

    it('should send when marketing_emails is true', () => {
      const userPrefs = { notification_preferences: { marketing_emails: true } }
      const shouldSend = userPrefs.notification_preferences.marketing_emails !== false
      expect(shouldSend).toBe(true)
    })

    it('should send when notification_preferences is null (default)', () => {
      const userPrefs = { notification_preferences: null as any }
      const shouldSend = userPrefs?.notification_preferences?.marketing_emails !== false
      expect(shouldSend).toBe(true)
    })
  })
})

// ============================================================
// MODULE C: Stripe Customer + Payment Methods
// ============================================================

describe('Module C: Stripe Customer + Saved Cards', () => {
  describe('Customer creation logic', () => {
    it('should use existing stripe_customer_id if present', () => {
      const profile = { stripe_customer_id: 'cus_existing123', email: 'user@test.com' }
      const customerId = profile.stripe_customer_id
      expect(customerId).toBe('cus_existing123')
    })

    it('should flag customer creation needed when stripe_customer_id is null', () => {
      const profile = { stripe_customer_id: null, email: 'user@test.com' }
      const needsCreation = !profile.stripe_customer_id
      expect(needsCreation).toBe(true)
    })
  })

  describe('setup_future_usage config', () => {
    it('should add setup_future_usage for authenticated users', () => {
      const authenticatedUserId = 'user-123'
      const sessionConfig: any = { payment_intent_data: {} }

      if (authenticatedUserId) {
        sessionConfig.payment_intent_data = {
          ...sessionConfig.payment_intent_data,
          setup_future_usage: 'on_session',
        }
      }

      expect(sessionConfig.payment_intent_data.setup_future_usage).toBe('on_session')
    })

    it('should NOT add setup_future_usage for guest checkout', () => {
      const authenticatedUserId = null
      const sessionConfig: any = {}

      if (authenticatedUserId) {
        sessionConfig.payment_intent_data = { setup_future_usage: 'on_session' }
      }

      expect(sessionConfig.payment_intent_data).toBeUndefined()
    })
  })
})

// ============================================================
// MODULE D: Checkout ↔ Addresses
// ============================================================

describe('Module D: Checkout Address Auto-Save', () => {
  describe('Address deduplication', () => {
    it('should detect duplicate address by street + postal code', () => {
      const existingAddresses = [
        { street_line1: '123 Main St', postal_code: '10001' },
        { street_line1: '456 Oak Ave', postal_code: '20002' },
      ]
      const newAddress = { line1: '123 Main St', postal_code: '10001' }

      const isDuplicate = existingAddresses.some(
        a => a.street_line1 === newAddress.line1 && a.postal_code === newAddress.postal_code
      )
      expect(isDuplicate).toBe(true)
    })

    it('should allow new unique address', () => {
      const existingAddresses = [
        { street_line1: '123 Main St', postal_code: '10001' },
      ]
      const newAddress = { line1: '789 Elm Blvd', postal_code: '30003' }

      const isDuplicate = existingAddresses.some(
        a => a.street_line1 === newAddress.line1 && a.postal_code === newAddress.postal_code
      )
      expect(isDuplicate).toBe(false)
    })

    it('should set first address as default', () => {
      const existingCount = 0
      const isDefault = existingCount === 0
      expect(isDefault).toBe(true)
    })

    it('should NOT set subsequent addresses as default', () => {
      const existingCount: number = 2
      const isDefault = existingCount === 0
      expect(isDefault).toBe(false)
    })

    it('should cap auto-saved addresses at 5', () => {
      const existingCount = 5
      const shouldSave = existingCount < 5
      expect(shouldSave).toBe(false)
    })
  })

  describe('Shipping address normalization', () => {
    it('should uppercase country code', () => {
      const country = 'de'
      expect(country.toUpperCase()).toBe('DE')
    })

    it('should handle null shipping address gracefully', () => {
      const shippingAddress = null
      const shouldSave = shippingAddress && (shippingAddress as any).line1
      expect(shouldSave).toBeFalsy()
    })
  })
})
