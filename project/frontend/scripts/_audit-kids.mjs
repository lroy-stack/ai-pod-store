/**
 * Audit kids products — check variants, images, color/size parsing in Supabase
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')

const supabase = createClient(SB_URL, SB_KEY)

const KIDS = ['Bug Reporter', 'Sudo Ice Cream', 'Bedtime 404', 'Ctrl+Z Homework', 'AI Raised Me', 'Code Works']

async function main() {
  for (const name of KIDS) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  ${name}`)
    console.log('═'.repeat(60))

    // Get product from Supabase
    const { data: products } = await supabase
      .from('products')
      .select('id, title, printify_id, images, base_price_cents')
      .eq('title', name)

    if (!products?.length) {
      console.log('  NOT FOUND in Supabase')
      continue
    }

    const p = products[0]
    const imgs = p.images || []
    console.log(`  Supabase ID: ${p.id}`)
    console.log(`  Printify ID: ${p.printify_id}`)
    console.log(`  Price: €${(p.base_price_cents / 100).toFixed(2)}`)
    console.log(`  Images in DB: ${imgs.length}`)

    // Filter unique mockup images (not size charts)
    const uniqueImgs = imgs.filter(i => i.src && !i.src.includes('size-chart'))
    console.log(`  Usable mockups: ${uniqueImgs.length}`)

    // Get variants from Supabase
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, color, size, title, image_url, is_enabled, price_cents, printify_variant_id')
      .eq('product_id', p.id)

    console.log(`  Variants in DB: ${variants?.length || 0}`)

    if (variants?.length) {
      const withImg = variants.filter(v => v.image_url)
      const noImg = variants.filter(v => !v.image_url)
      console.log(`  With image_url: ${withImg.length} | Without: ${noImg.length}`)

      const colors = [...new Set(variants.map(v => v.color))]
      const sizes = [...new Set(variants.map(v => v.size))]
      console.log(`  Colors parsed: ${colors.join(', ')}`)
      console.log(`  Sizes parsed: ${sizes.join(', ')}`)

      // Detect swapped color/size
      const sizePatterns = /^(XS|S|M|L|XL|2XL|3XL|2XS|NB|[0-9])/i
      const colorInSize = sizes.filter(s => !sizePatterns.test(s))
      const sizeInColor = colors.filter(c => sizePatterns.test(c))
      if (colorInSize.length > 0) console.log(`  ⚠ COLORS IN SIZE FIELD: ${colorInSize.join(', ')}`)
      if (sizeInColor.length > 0) console.log(`  ⚠ SIZES IN COLOR FIELD: ${sizeInColor.join(', ')}`)

      // Show sample
      console.log(`  Sample variants:`)
      variants.slice(0, 4).forEach(v => {
        console.log(`    "${v.title}" → color: "${v.color}", size: "${v.size}", img: ${v.image_url ? 'YES' : 'NO'}`)
      })
    }

    // Check Printify for the back design duplication
    if (p.printify_id) {
      try {
        const res = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${p.printify_id}.json`, {
          headers: { Authorization: `Bearer ${TOKEN}` }
        })
        const pp = await res.json()

        console.log(`  Printify images: ${pp.images?.length || 0}`)

        // Check print areas
        if (pp.print_areas) {
          pp.print_areas.forEach(pa => {
            console.log(`  Print area (${pa.variant_ids?.length} variant_ids):`)
            pa.placeholders?.forEach(ph => {
              const imgCount = ph.images?.length || 0
              const imgNames = ph.images?.map(i => i.name || i.id).join(', ') || 'none'
              console.log(`    ${ph.position}: ${imgCount} image(s) — ${imgNames}`)
            })
          })
        }
      } catch (e) {
        console.log(`  Printify fetch error: ${e.message}`)
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
