/**
 * POST /api/reviews/upload-photos
 * Upload review photos to Supabase Storage
 * Returns array of public URLs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const formData = await req.formData()
    const photos = formData.getAll('photos') as File[]

    if (photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 })
    }

    if (photos.length > 3) {
      return NextResponse.json({ error: 'Maximum 3 photos allowed' }, { status: 400 })
    }

    const uploadedUrls: string[] = []

    for (const photo of photos) {
      // Validate file type — explicit allowlist to reject SVG and other unsafe types
      const SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
      if (!SAFE_IMAGE_TYPES.has(photo.type)) {
        return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images allowed' }, { status: 400 })
      }

      // Validate file size (5MB max)
      if (photo.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Photo exceeds 5MB limit' }, { status: 400 })
      }

      // Generate unique filename
      const ext = photo.name.split('.').pop()
      const filename = `review-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

      // Upload to Supabase Storage
      const arrayBuffer = await photo.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const { data, error } = await supabaseAdmin.storage
        .from('review-photos')
        .upload(filename, buffer, {
          contentType: photo.type,
          cacheControl: '31536000', // 1 year
        })

      if (error) {
        console.error('[Upload] Supabase storage error:', error)
        return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('review-photos')
        .getPublicUrl(data.path)

      uploadedUrls.push(publicUrl)
    }

    return NextResponse.json({ urls: uploadedUrls })
  } catch (error) {
    console.error('[Upload] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
