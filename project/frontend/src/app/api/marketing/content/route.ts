import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('marketing_content')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ content: data, count: data?.length || 0 })
  } catch (err) {
    const resp = authErrorResponse(err)
    if (resp) return resp
    console.error('Error fetching marketing content:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
