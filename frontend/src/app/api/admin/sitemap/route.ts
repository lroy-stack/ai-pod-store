import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'
import { BASE_URL } from '@/lib/store-config'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error) {
    return authErrorResponse(error)
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get count of all products
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    // Revalidate sitemap routes for all locales
    const locales = ['en', 'es', 'de']

    // Revalidate main sitemap
    revalidatePath('/sitemap.xml')

    // Revalidate locale-specific sitemaps
    for (const locale of locales) {
      revalidatePath(`/sitemap-${locale}.xml`)
    }

    return NextResponse.json({
      success: true,
      message: 'Sitemaps regenerated successfully',
      productCount: productCount || 0,
      locales,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error regenerating sitemaps:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate sitemaps'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error) {
    return authErrorResponse(error)
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get sitemap information
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    const baseUrl = BASE_URL
    const locales = ['en', 'es', 'de']

    return NextResponse.json({
      success: true,
      sitemaps: [
        {
          url: `${baseUrl}/sitemap.xml`,
          locale: 'index',
          lastGenerated: new Date().toISOString(),
        },
        ...locales.map((locale) => ({
          url: `${baseUrl}/sitemap-${locale}.xml`,
          locale,
          lastGenerated: new Date().toISOString(),
          productCount: productCount || 0,
        })),
      ],
    })
  } catch (error) {
    console.error('Error fetching sitemap info:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch sitemap info'
      },
      { status: 500 }
    )
  }
}
