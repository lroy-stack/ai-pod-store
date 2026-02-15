import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Admin auth check
async function checkAdminAuth() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('admin-session')

  if (!sessionCookie) {
    return null
  }

  try {
    const session = JSON.parse(sessionCookie.value)
    if (session.role !== 'admin') {
      return null
    }
    return session
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  // Check admin authentication
  const session = await checkAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('return_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    // Filter by status if provided
    if (status && ['pending', 'approved', 'rejected', 'processing', 'completed'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch returns', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ returns: data || [] })
  } catch (error) {
    console.error('Error fetching returns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
