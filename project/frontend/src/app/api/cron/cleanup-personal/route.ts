/**
 * GET /api/cron/cleanup-personal
 *
 * Cron-triggered cleanup of expired personal designs.
 * Deletes designs with privacy_level='personal' and expires_at < now()
 * from both Supabase Storage and the designs table.
 *
 * Should be called daily via Vercel Cron or external scheduler.
 * Protected by Bearer token authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCronSecret } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  // Verify cron secret (timing-safe)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find expired personal designs
    const { data: expired, error } = await supabase
      .from('designs')
      .select('id, image_url, bg_removed_url')
      .eq('privacy_level', 'personal')
      .lt('expires_at', new Date().toISOString())
      .limit(100)

    if (error) {
      console.error('Failed to query expired designs:', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!expired || expired.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No expired personal designs' })
    }

    // Collect storage paths to delete
    const storagePaths: string[] = []
    for (const design of expired) {
      for (const url of [design.image_url, design.bg_removed_url]) {
        if (url && url.includes('/storage/v1/object/public/designs/')) {
          const path = url.split('/storage/v1/object/public/designs/')[1]
          if (path) storagePaths.push(path)
        }
      }
    }

    // Delete from Storage
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('designs')
        .remove(storagePaths)

      if (storageError) {
        console.warn('Some storage deletions failed:', storageError)
      }
    }

    // Delete from database
    const ids = expired.map((d) => d.id)
    const { error: deleteError } = await supabase
      .from('designs')
      .delete()
      .in('id', ids)

    if (deleteError) {
      console.error('Failed to delete expired designs:', deleteError)
      return NextResponse.json({ error: 'Delete failed', deleted: 0 }, { status: 500 })
    }

    return NextResponse.json({
      deleted: ids.length,
      storageFilesRemoved: storagePaths.length,
      message: `Cleaned up ${ids.length} expired personal designs`,
    })
  } catch (err) {
    console.error('Cleanup cron error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
