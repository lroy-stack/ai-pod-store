import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { historyLimiter } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  try {
    // Auth required for design history
    let user
    try {
      user = await requireAuth(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    // Rate limiting: 30 history requests per minute per user
    const rateLimitKey = `design:history:${user.id}`
    const rateLimitResult = historyLimiter.check(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum 30 history requests per minute. Please wait and try again.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'Retry-After': '60',
          }
        }
      )
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10')
    const productType = req.nextUrl.searchParams.get('product_type')

    let query = supabaseAdmin
      .from('ai_generations')
      .select('id, prompt, image_url, provider, inference_ms, intent, is_refinement, created_at, session_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (productType) {
      // Join through design_sessions to filter by product_type
      query = query.not('image_url', 'is', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching design history:', error)
      return NextResponse.json({ generations: [] })
    }

    return NextResponse.json({ generations: data || [] })
  } catch (error) {
    console.error('Design history error:', error)
    return NextResponse.json({ generations: [] })
  }
}
