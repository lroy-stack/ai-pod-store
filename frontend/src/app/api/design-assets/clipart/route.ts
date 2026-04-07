import { NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase-anon'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    let query = supabaseAnon
      .from('design_clipart')
      .select('id, name, name_es, name_de, category, tags, svg_url, thumbnail_url, use_count')
      .eq('is_active', true)
      .order('use_count', { ascending: false })
      .limit(100)

    if (category) query = query.eq('category', category)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
