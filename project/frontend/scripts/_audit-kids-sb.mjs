import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const sb = createClient(SB_URL, SB_KEY)

const KIDS = ['Bug Reporter', 'Sudo Ice Cream', 'Bedtime 404', 'Ctrl+Z Homework', 'AI Raised Me', 'Code Works']

async function main() {
  for (const name of KIDS) {
    const { data: prods } = await sb.from('products').select('id, title, images').eq('title', name)
    if (prods.length === 0) { console.log(name + ': NOT FOUND'); continue }

    const p = prods[0]
    const imgs = p.images || []
    console.log('\n' + '='.repeat(50))
    console.log(name)
    console.log('='.repeat(50))
    console.log('Supabase images:', imgs.length)

    imgs.forEach((img, i) => {
      const label = (img.src || '').match(/camera_label=([^&]*)/)?.[1] || 'unknown'
      console.log(`  [${i}] default:${img.is_default} label:${label} variants:${img.variant_ids?.length || 0}`)
    })

    if (imgs.length > 0) {
      const firstLabel = (imgs[0].src || '').match(/camera_label=([^&]*)/)?.[1] || 'unknown'
      console.log(`  CARD IMAGE: ${firstLabel}${firstLabel === 'front' ? ' OK' : ' !!! NOT FRONT'}`)
    }

    const { data: vars } = await sb.from('product_variants')
      .select('color, size, title, image_url, is_enabled')
      .eq('product_id', p.id)
    console.log('Variants:', vars?.length || 0)

    if (vars?.length) {
      const colors = [...new Set(vars.map(v => v.color))]
      const sizes = [...new Set(vars.map(v => v.size))]
      console.log('Colors:', colors.join(', '))
      console.log('Sizes:', sizes.join(', '))

      const sizeRe = /^(XS|S|M|L|XL|2XL|3XL|2XS|NB|[0-9])/i
      const badColors = colors.filter(c => sizeRe.test(c))
      const badSizes = sizes.filter(s => s && !sizeRe.test(s) && s !== 'One Size')
      if (badColors.length) console.log('!!! SIZES IN COLOR FIELD:', badColors.join(', '))
      if (badSizes.length) console.log('!!! COLORS IN SIZE FIELD:', badSizes.join(', '))

      const withImg = vars.filter(v => v.image_url)
      console.log(`With image_url: ${withImg.length}/${vars.length}`)

      console.log('Sample:')
      vars.slice(0, 3).forEach(v => {
        console.log(`  "${v.title}" -> color="${v.color}" size="${v.size}" img=${v.image_url ? 'YES' : 'NO'}`)
      })
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
