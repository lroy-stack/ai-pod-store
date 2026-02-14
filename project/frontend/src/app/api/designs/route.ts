import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/designs
 * Fetch user's generated designs
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Get user ID from session/auth
    // For now, fetch all designs (will add auth later)
    const userId = req.headers.get('x-user-id') // Placeholder for auth

    const query = supabaseAdmin
      .from('designs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    // If user ID is provided, filter by user
    if (userId) {
      query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch designs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch designs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      designs: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('GET /api/designs error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
