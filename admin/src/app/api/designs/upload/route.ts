import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withPermission } from '@/lib/rbac'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']

export const POST = withPermission('designs', 'create', async (req: NextRequest, _session: unknown) => {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPG, or SVG.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    const prompt = formData.get('prompt') as string | null
    const model = formData.get('model') as string | null
    const tagsRaw = formData.get('tags') as string | null
    let tags: string[] = []
    if (tagsRaw) {
      try {
        tags = JSON.parse(tagsRaw)
      } catch {
        tags = []
      }
    }

    // Generate unique filename
    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/png' ? 'png' : 'jpg'
    const filename = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('designs')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from('designs').getPublicUrl(filename)
    const imageUrl = urlData?.publicUrl

    // Insert design record into DB
    const { data: design, error: dbError } = await supabaseAdmin
      .from('designs')
      .insert({
        image_url: imageUrl,
        prompt: prompt || null,
        model: model || null,
        source_type: 'sourced',
        moderation_status: 'approved',
        tags: tags.length > 0 ? tags : [],
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB insert error:', dbError)
      // Try to clean up storage
      await supabaseAdmin.storage.from('designs').remove([filename])
      return NextResponse.json({ error: 'Failed to save design metadata' }, { status: 500 })
    }

    return NextResponse.json({ design, path: uploadData.path, url: imageUrl }, { status: 201 })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
