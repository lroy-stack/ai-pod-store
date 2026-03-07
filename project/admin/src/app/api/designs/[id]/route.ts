import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAuth } from '@/lib/auth-middleware'
import { withPermission } from '@/lib/rbac'
import { withValidation } from '@/lib/validation'
import { designUpdateSchema } from '@/lib/schemas/extended'

export const GET = withAuth(async (
  request: NextRequest,
  _session: unknown,
  context?: { params?: Promise<{ id: string }> }
) => {
  const id = context?.params ? (await context.params).id : new URL(request.url).pathname.split('/').at(-1)!

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
    const { data, error } = await supabase
      .from('designs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Design not found' },
        { status: 404 }
      )
    }

    // Find products that reference this design's image_url in their images JSONB
    let linkedProducts: Array<{ id: string; title: string; slug: string }> = []
    if (data?.image_url) {
      const { data: products } = await supabase
        .from('products')
        .select('id, title, slug, images')
        .not('images', 'is', null)
      if (products) {
        for (const p of products) {
          const imgs: Array<{ src?: string }> = p.images || []
          if (imgs.some((img) => img.src === data.image_url)) {
            linkedProducts.push({ id: p.id, title: p.title, slug: p.slug })
          }
        }
      }
    }

    return NextResponse.json({ design: { ...data, linked_products: linkedProducts } })
  } catch (error) {
    console.error('Error fetching design:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const PATCH = withPermission('designs', 'update', withValidation(designUpdateSchema, async (
  request: NextRequest,
  validatedData,
  session,
  context: { params?: Promise<{ id: string }> }
) => {
  const { id } = await context.params!

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
    const { data, error } = await supabase
      .from('designs')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to update design' },
        { status: 500 }
      )
    }

    return NextResponse.json({ design: data })
  } catch (error) {
    console.error('Error updating design:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}))
