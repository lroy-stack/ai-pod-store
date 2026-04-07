import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Missing composition ID' }, { status: 400 })
    }

    const { supabase, user } = await createServerClient(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // RLS policy enforces user_id = auth.uid()
    const { data, error } = await supabase
      .from('design_compositions')
      .select('id, schema_version, layers, product_type, product_id, preview_url, status')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Composition not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('composition fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
