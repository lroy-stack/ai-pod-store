import { NextRequest, NextResponse } from 'next/server'
import { removeBackground } from '@/lib/providers/background-removal'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { removeBgLimiter } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/** SSRF protection: only allow HTTPS URLs from known image providers */
// Add your custom domain via STORE_DOMAIN env var — it is injected at runtime below
const ALLOWED_IMAGE_DOMAINS = [
  process.env.STORE_DOMAIN || '',  // Your production domain (set in .env)
  'supabase.co',           // Supabase cloud storage
  'supabase.in',           // Supabase self-hosted
  'fal.media',             // fal.ai CDN
  'fal.run',               // fal.ai results
  'v3.fal.media',          // fal.ai v3 CDN
  'replicate.delivery',    // Replicate CDN
  'pbxt.replicate.delivery', // Replicate proxy
  'oaidalleapiprodscus.blob.core.windows.net', // OpenAI DALL-E
  'ideogram.ai',           // Ideogram CDN
  'img.recraft.ai',        // Recraft CDN
]

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return ALLOWED_IMAGE_DOMAINS.some(domain => parsed.hostname.endsWith(domain))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Rate limiting: 10 background removals per minute per user
    const rateLimitKey = `design:remove-bg:${user.id}`
    const rateLimitResult = removeBgLimiter.check(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum 10 background removals per minute. Please wait and try again.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'Retry-After': '60',
          }
        }
      )
    }

    const { imageUrl, designId } = await req.json()

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }

    // SSRF protection: only allow HTTPS URLs from trusted image domains
    if (!isAllowedImageUrl(imageUrl)) {
      return NextResponse.json({ error: 'Invalid image URL. Only HTTPS URLs from trusted sources are accepted.' }, { status: 400 })
    }

    const result = await removeBackground(imageUrl)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Background removal failed' },
        { status: 502 }
      )
    }

    // Update design record if designId provided — with ownership verification
    if (designId && result.imageUrl) {
      const { data: design } = await supabase
        .from('designs')
        .select('user_id')
        .eq('id', designId)
        .single()

      if (!design || design.user_id !== user.id) {
        return NextResponse.json({ error: 'Design not found' }, { status: 404 })
      }

      await supabase
        .from('designs')
        .update({ image_url: result.imageUrl })
        .eq('id', designId)
        .eq('user_id', user.id)
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
    const resp = authErrorResponse(error)
    if (resp) return resp
    console.error('remove-bg error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
