/**
 * POST /api/designs/upload
 *
 * Upload a user image to Supabase Storage and create a design record.
 * Accepts FormData with 'image' field (png/jpg/webp/svg, max 10MB).
 * Returns { success, design: { id, image_url } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { designSaveLimiter } from '@/lib/rate-limit'

const BUCKET = 'designs'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

const PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Rate limit: 10 uploads/min per user
    const rl = designSaveLimiter.check(`design:upload:${user.id}`)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many uploads. Try again later.' },
        { status: 429 }
      )
    }

    // Parse FormData
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported format. Use PNG, JPG, WebP, or SVG.' },
        { status: 400 }
      )
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum 10MB.' },
        { status: 400 }
      )
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Determine extension
    const ext = file.type === 'image/svg+xml'
      ? 'svg'
      : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'image/jpeg'
          ? 'jpg'
          : 'png'
    const contentType = file.type

    // Upload to Storage: designs/uploads/{user_id}/{uuid}.{ext}
    const filename = `uploads/${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType,
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('[designs/upload] Storage error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      )
    }

    const imageUrl = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`

    // Create design record
    const { data: design, error: dbError } = await supabaseAdmin
      .from('designs')
      .insert({
        user_id: user.id,
        prompt: 'User upload',
        image_url: imageUrl,
        privacy_level: 'private',
        moderation_status: 'approved',
      })
      .select('id, image_url')
      .single()

    if (dbError) {
      console.error('[designs/upload] DB error:', dbError)
      return NextResponse.json(
        { error: 'Failed to save design record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      design: { id: design.id, image_url: design.image_url },
      storageUrl: imageUrl,
    })
  } catch (error) {
    const resp = authErrorResponse(error)
    if (resp) return resp
    console.error('[designs/upload] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
