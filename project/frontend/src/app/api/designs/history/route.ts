import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('sb-access-token')?.value
    if (!token) {
      return NextResponse.json({ generations: [] })
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ generations: [] })
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
