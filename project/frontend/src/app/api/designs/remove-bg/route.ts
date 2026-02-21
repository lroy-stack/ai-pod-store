import { NextResponse } from 'next/server'
import { removeBackground } from '@/lib/providers/background-removal'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: Request) {
  try {
    const { imageUrl, designId } = await req.json()

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }

    const result = await removeBackground(imageUrl)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Background removal failed' },
        { status: 502 }
      )
    }

    // Update design record if designId provided
    if (designId && result.imageUrl) {
      await supabase
        .from('designs')
        .update({ image_url: result.imageUrl })
        .eq('id', designId)
        .then(({ error }) => {
          if (error) console.error('Failed to update design after bg removal:', error)
        })
    }

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      provider: result.provider,
      costUsd: result.costUsd,
    })
  } catch (error) {
    console.error('remove-bg error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
