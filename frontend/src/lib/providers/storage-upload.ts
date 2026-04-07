/**
 * Supabase Storage helpers for persisting generated images.
 * OpenAI returns base64 (never URLs). Ideogram returns ephemeral URLs.
 * This module uploads both to persistent Supabase Storage.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = 'designs'
let bucketEnsured = false

// Public URL base for browser-accessible storage URLs.
// NEXT_PUBLIC_SUPABASE_URL is the external URL (your self-hosted Supabase API URL).
// supabaseAdmin uses SUPABASE_URL (http://kong:8000, internal Docker) which
// is correct for DB queries but generates unreachable URLs for the browser.
const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''

function buildPublicUrl(bucket: string, filename: string): string {
  return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`
}

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return
  try {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true })
  } catch {
    // Bucket already exists — safe to ignore
  }
  bucketEnsured = true
}

/**
 * Upload a base64-encoded image to Supabase Storage.
 * Used for OpenAI responses (always base64).
 */
export async function uploadBase64ToStorage(
  base64: string,
  opts?: { format?: 'png' | 'svg'; prefix?: string }
): Promise<string> {
  await ensureBucket()

  const format = opts?.format || 'png'
  const prefix = opts?.prefix || 'gen'
  const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png'

  const buffer = Buffer.from(base64, 'base64')
  const filename = `${prefix}/${crypto.randomUUID()}.${format}`

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType,
      cacheControl: '31536000',
    })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  return buildPublicUrl(BUCKET, filename)
}

/**
 * Download an ephemeral URL and persist to Supabase Storage.
 * Used for Ideogram responses (URLs expire).
 */
export async function persistEphemeralUrl(
  imageUrl: string,
  opts?: { format?: 'png' | 'svg'; prefix?: string }
): Promise<string> {
  await ensureBucket()

  const format = opts?.format || 'png'
  const prefix = opts?.prefix || 'gen'
  const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png'

  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const filename = `${prefix}/${crypto.randomUUID()}.${format}`

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType,
      cacheControl: '31536000',
    })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  return buildPublicUrl(BUCKET, filename)
}
