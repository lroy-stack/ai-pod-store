import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/rate-limit'

/**
 * POST /api/revalidate/theme
 * Invalidates the SSR theme cache so the next page load uses fresh data.
 * Called by the admin app after activating a theme.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  // Use REVALIDATION_SECRET (falls back to CRON_SECRET) — never expose the Supabase service key
  const expectedKey = process.env.REVALIDATION_SECRET || process.env.CRON_SECRET

  if (!verifyCronSecret(authHeader, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  revalidateTag('store-theme', { expire: 0 })

  return NextResponse.json({ revalidated: true })
}
