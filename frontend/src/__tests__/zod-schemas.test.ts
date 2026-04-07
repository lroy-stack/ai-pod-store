import { describe, it, expect } from 'vitest'
import { z } from 'zod'

/**
 * Zod schema tests
 * These schemas are used throughout the application for request validation
 */

// Design schema (from /api/designs/route.ts)
const saveDesignSchema = z.object({
  prompt: z.string().min(1),
  style: z.string().optional(),
  model: z.string().optional(),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  productId: z.string().uuid().optional(),
})

// Newsletter subscription schema (from /api/newsletter/subscribe/route.ts)
const subscribeSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['en', 'es', 'de']).default('en'),
})

// Profile update schema (common pattern in user settings)
const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  locale: z.enum(['en', 'es', 'de']).optional(),
  currency: z.enum(['EUR', 'USD', 'GBP']).optional(),
  notification_preferences: z
    .object({
      email: z.boolean(),
      push: z.boolean(),
      sms: z.boolean(),
    })
    .optional(),
})

describe('saveDesignSchema', () => {
  it('should validate a complete design object', () => {
    const validDesign = {
      prompt: 'A beautiful sunset',
      style: 'realistic',
      model: 'dall-e-3',
      imageUrl: 'https://example.com/image.jpg',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      width: 1024,
      height: 1024,
      productId: '550e8400-e29b-41d4-a716-446655440000',
    }

    const result = saveDesignSchema.safeParse(validDesign)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validDesign)
    }
  })

  it('should validate a minimal design object', () => {
    const minimalDesign = {
      prompt: 'Simple prompt',
      imageUrl: 'https://example.com/image.jpg',
    }

    const result = saveDesignSchema.safeParse(minimalDesign)
    expect(result.success).toBe(true)
  })

  it('should reject empty prompt', () => {
    const invalidDesign = {
      prompt: '',
      imageUrl: 'https://example.com/image.jpg',
    }

    const result = saveDesignSchema.safeParse(invalidDesign)
    expect(result.success).toBe(false)
  })

  it('should reject invalid imageUrl', () => {
    const invalidDesign = {
      prompt: 'Test prompt',
      imageUrl: 'not-a-url',
    }

    const result = saveDesignSchema.safeParse(invalidDesign)
    expect(result.success).toBe(false)
  })

  it('should reject invalid UUID for productId', () => {
    const invalidDesign = {
      prompt: 'Test prompt',
      imageUrl: 'https://example.com/image.jpg',
      productId: 'not-a-uuid',
    }

    const result = saveDesignSchema.safeParse(invalidDesign)
    expect(result.success).toBe(false)
  })

  it('should accept valid UUID for productId', () => {
    const validDesign = {
      prompt: 'Test prompt',
      imageUrl: 'https://example.com/image.jpg',
      productId: '123e4567-e89b-12d3-a456-426614174000',
    }

    const result = saveDesignSchema.safeParse(validDesign)
    expect(result.success).toBe(true)
  })
})

describe('subscribeSchema', () => {
  it('should validate a complete subscription', () => {
    const validSubscription = {
      email: 'user@example.com',
      locale: 'en' as const,
    }

    const result = subscribeSchema.safeParse(validSubscription)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
      expect(result.data.locale).toBe('en')
    }
  })

  it('should default locale to "en" if not provided', () => {
    const subscription = {
      email: 'user@example.com',
    }

    const result = subscribeSchema.safeParse(subscription)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.locale).toBe('en')
    }
  })

  it('should accept all valid locales (en, es, de)', () => {
    const locales = ['en', 'es', 'de'] as const

    locales.forEach((locale) => {
      const subscription = {
        email: 'user@example.com',
        locale,
      }

      const result = subscribeSchema.safeParse(subscription)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.locale).toBe(locale)
      }
    })
  })

  it('should reject invalid email', () => {
    const invalidSubscription = {
      email: 'not-an-email',
      locale: 'en' as const,
    }

    const result = subscribeSchema.safeParse(invalidSubscription)
    expect(result.success).toBe(false)
  })

  it('should reject invalid locale', () => {
    const invalidSubscription = {
      email: 'user@example.com',
      locale: 'fr' as any, // Invalid locale
    }

    const result = subscribeSchema.safeParse(invalidSubscription)
    expect(result.success).toBe(false)
  })
})

describe('profileUpdateSchema', () => {
  it('should validate a complete profile update', () => {
    const validProfile = {
      name: 'John Doe',
      email: 'john@example.com',
      locale: 'en' as const,
      currency: 'EUR' as const,
      notification_preferences: {
        email: true,
        push: false,
        sms: false,
      },
    }

    const result = profileUpdateSchema.safeParse(validProfile)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validProfile)
    }
  })

  it('should validate partial profile update', () => {
    const partialProfile = {
      name: 'Jane Doe',
    }

    const result = profileUpdateSchema.safeParse(partialProfile)
    expect(result.success).toBe(true)
  })

  it('should reject empty name', () => {
    const invalidProfile = {
      name: '',
    }

    const result = profileUpdateSchema.safeParse(invalidProfile)
    expect(result.success).toBe(false)
  })

  it('should reject name longer than 100 characters', () => {
    const invalidProfile = {
      name: 'a'.repeat(101),
    }

    const result = profileUpdateSchema.safeParse(invalidProfile)
    expect(result.success).toBe(false)
  })

  it('should reject invalid email', () => {
    const invalidProfile = {
      email: 'not-an-email',
    }

    const result = profileUpdateSchema.safeParse(invalidProfile)
    expect(result.success).toBe(false)
  })

  it('should reject invalid locale', () => {
    const invalidProfile = {
      locale: 'fr' as any,
    }

    const result = profileUpdateSchema.safeParse(invalidProfile)
    expect(result.success).toBe(false)
  })

  it('should reject invalid currency', () => {
    const invalidProfile = {
      currency: 'JPY' as any,
    }

    const result = profileUpdateSchema.safeParse(invalidProfile)
    expect(result.success).toBe(false)
  })

  it('should validate notification preferences', () => {
    const validProfile = {
      notification_preferences: {
        email: true,
        push: true,
        sms: false,
      },
    }

    const result = profileUpdateSchema.safeParse(validProfile)
    expect(result.success).toBe(true)
  })
})
