/**
 * Translation cache using Redis
 *
 * Caches translation data per locale to reduce file I/O.
 * Falls back gracefully if Redis is unavailable.
 */

import { getCached, setCached } from './redis'

const CACHE_TTL = 3600 // 1 hour
const CACHE_KEY_PREFIX = 'translations:'

/**
 * Get cached translations for a locale
 * Returns null if cache miss or Redis unavailable
 */
export async function getCachedTranslations(
  locale: string
): Promise<Record<string, any> | null> {
  const key = `${CACHE_KEY_PREFIX}${locale}`
  try {
    const cached = await getCached(key)
    return cached
  } catch (error) {
    console.warn('[TranslationCache] Failed to get cached translations:', error)
    return null
  }
}

/**
 * Set cached translations for a locale
 * Silently fails if Redis unavailable
 */
export async function setCachedTranslations(
  locale: string,
  translations: Record<string, any>
): Promise<void> {
  const key = `${CACHE_KEY_PREFIX}${locale}`
  try {
    await setCached(key, translations, CACHE_TTL)
  } catch (error) {
    console.warn('[TranslationCache] Failed to set cached translations:', error)
  }
}
