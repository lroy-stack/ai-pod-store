/**
 * Translation cache test endpoint
 *
 * This demonstrates Redis caching for translations (when available).
 * In production, Next.js handles translation caching via dynamic imports.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getCachedTranslations,
  setCachedTranslations,
} from '@/lib/translation-cache'
import { isRedisAvailable } from '@/lib/redis'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') || 'en'

  // Validate locale
  if (!['en', 'es', 'de'].includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
  }

  const startTime = Date.now()

  // Try cache first
  let translations = await getCachedTranslations(locale)
  const fromCache = translations !== null

  if (!translations) {
    // Load from file
    try {
      translations = (await import(`../../../../../messages/${locale}.json`))
        .default

      // Cache for next time (fire and forget)
      if (translations) {
        setCachedTranslations(locale, translations).catch(() => {
          // Silent fail - caching is optional
        })
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to load translations' },
        { status: 500 }
      )
    }
  }

  const duration = Date.now() - startTime

  return NextResponse.json({
    locale,
    translationCount: translations ? Object.keys(translations).length : 0,
    fromCache,
    redisAvailable: isRedisAvailable(),
    duration,
    cacheKey: `translations:${locale}`,
  })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') || 'en'

  // Validate locale
  if (!['en', 'es', 'de'].includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
  }

  try {
    // Load translations from file
    const translations = (
      await import(`../../../../../messages/${locale}.json`)
    ).default

    // Force cache update
    await setCachedTranslations(locale, translations)

    return NextResponse.json({
      success: true,
      locale,
      translationCount: Object.keys(translations).length,
      redisAvailable: isRedisAvailable(),
      cacheKey: `translations:${locale}`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to cache translations', message: error.message },
      { status: 500 }
    )
  }
}
