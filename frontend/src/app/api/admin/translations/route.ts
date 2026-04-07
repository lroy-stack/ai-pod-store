/**
 * Admin Translations API
 *
 * Returns translation data for a given locale.
 * Used for admin translation management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error) {
    return authErrorResponse(error)
  }

  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') || 'en'

  // Validate locale
  const validLocales = ['en', 'es', 'de']
  if (!validLocales.includes(locale)) {
    return NextResponse.json(
      { error: 'Invalid locale', validLocales },
      { status: 400 }
    )
  }

  try {
    // Load translations from file
    const translations = (await import(`../../../../../messages/${locale}.json`))
      .default

    return NextResponse.json({
      locale,
      translations,
      keyCount: Object.keys(translations).length,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load translations', message: error.message },
      { status: 500 }
    )
  }
}
