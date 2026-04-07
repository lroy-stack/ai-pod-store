import { NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase-anon'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const productType = searchParams.get('product_type')

    let query = supabaseAnon
      .from('design_templates_library')
      .select('id, name, name_es, name_de, category, tags, thumbnail_url, fabric_json, product_types, use_count')
      .eq('is_active', true)
      .order('use_count', { ascending: false })
      .limit(50)

    if (category) query = query.eq('category', category)
    if (search) query = query.ilike('name', `%${search}%`)
    if (productType) query = query.or(`product_types.cs.{${productType}},product_types.cs.{all}`)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
