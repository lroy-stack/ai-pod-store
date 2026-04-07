/**
 * POST /api/profile/avatar
 * Upload and resize user avatar to Supabase Storage bucket 'avatars'.
 * Accepts FormData with 'avatar' field (image/*, max 2MB).
 * Returns { avatar_url: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { avatarUploadLimiter } from '@/lib/rate-limit'

const BUCKET = 'avatars'
let bucketEnsured = false

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return
  try {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true })
  } catch {
    // Bucket already exists — safe to ignore
  }
  bucketEnsured = true
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Rate limit
    const rl = avatarUploadLimiter.check(`avatar:${user.id}`)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 })
    }

    // Parse FormData
    const formData = await req.formData()
    const file = formData.get('avatar') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 })
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be smaller than 2MB' }, { status: 400 })
    }

    // Resize to 256x256 WebP
    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const resized = await sharp(rawBuffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    // Upload to Supabase Storage
    await ensureBucket()
    const filename = `${user.id}/${Date.now()}.webp`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filename, resized, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      })

    if (uploadError) {
      console.error('[Avatar] Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(filename)

    // Delete old avatar if it exists in the same bucket
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    if (currentUser?.avatar_url) {
      const oldUrl = currentUser.avatar_url as string
      // Extract path from public URL (after /avatars/)
      const match = oldUrl.match(/\/avatars\/(.+?)(\?|$)/)
      if (match?.[1] && match[1] !== filename) {
        await supabaseAdmin.storage.from(BUCKET).remove([match[1]])
      }
    }

    // Update users.avatar_url
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    if (updateError) {
      console.error('[Avatar] DB update error:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ avatar_url: publicUrl })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('[Avatar] Error:', error)
    return NextResponse.json({ error: 'Avatar upload failed' }, { status: 500 })
  }
}
