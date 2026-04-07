import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BASE_URL } from '@/lib/store-config'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export async function GET() {
  const baseUrl = BASE_URL
  const locale = 'en'

  try {
    // Create Supabase client with service key for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Fetch all products
    const { data: products, error } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching products for sitemap-en:', error)
    }

    const urls: string[] = []

    // Add main pages
    const pages = [
      { path: '', priority: '1.0', changefreq: 'daily' },
      { path: '/shop', priority: '0.9', changefreq: 'daily' },
      { path: '/about', priority: '0.5', changefreq: 'monthly' },
      { path: '/contact', priority: '0.5', changefreq: 'monthly' },
      { path: '/faq', priority: '0.5', changefreq: 'monthly' },
      { path: '/privacy', priority: '0.3', changefreq: 'monthly' },
      { path: '/terms', priority: '0.3', changefreq: 'monthly' },
      { path: '/shipping', priority: '0.4', changefreq: 'monthly' },
      { path: '/returns', priority: '0.4', changefreq: 'monthly' },
    ]

    pages.forEach((page) => {
      urls.push(`
  <url>
    <loc>${baseUrl}/${locale}${page.path}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`)
    })

    // Add category landing pages (fetched dynamically from DB)
    const { data: categories } = await supabase
      .from('categories')
      .select('slug')
      .eq('is_active', true)

    ;(categories || []).forEach((cat) => {
      urls.push(`
  <url>
    <loc>${baseUrl}/${locale}/shop/category/${cat.slug}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
    })

    // Add product pages
    if (products && products.length > 0) {
      products.forEach((product) => {
        const lastmod = product.updated_at
          ? new Date(product.updated_at).toISOString()
          : new Date().toISOString()

        urls.push(`
  <url>
    <loc>${baseUrl}/${locale}/shop/${product.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
      })
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
      },
    })
  } catch (error) {
    console.error('Error generating sitemap-en.xml:', error)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      {
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    )
  }
}
