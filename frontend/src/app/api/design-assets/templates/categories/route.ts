import { NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase-anon'

export async function GET() {
  try {
    const { data, error } = await supabaseAnon
      .from('design_templates_library')
      .select('category')
      .eq('is_active', true)

    if (error) {
      return NextResponse.json([], { status: 500 })
    }

    const unique = [...new Set((data || []).map(d => d.category).filter(Boolean))].sort()
    return NextResponse.json(unique)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
