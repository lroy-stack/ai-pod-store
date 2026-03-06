import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const sb = createClient(SB_URL, SB_KEY)

const PRODUCTS = {
  2: { name: 'Bug Reporter',    pid: '69a38b2546730b56700a4018', sid: '743f1925-cb78-4ad9-a73d-3c29be80464d' },
  3: { name: 'Sudo Ice Cream',  pid: '69a38b5d1ec5ca402c0352e0', sid: '8982c0a2-1761-44bd-884f-d861592099aa' },
  4: { name: 'Bedtime 404',     pid: '69a38b853b12a90c8e089201', sid: '8aa671b9-5dad-41b8-887f-27c27e8520c7' },
  5: { name: 'Ctrl+Z Homework', pid: '69a38bac5a653e214b0be2f4', sid: '2c0e6015-6b4c-4713-948a-a58efb96cbb0' },
  6: { name: 'AI Raised Me',    pid: '69a38bda3b12a90c8e08920c', sid: '62c85f65-3d67-4961-9024-ab45e7100b57' },
  7: { name: 'Code Works',      pid: '69a38c03874d66e74c0ea105', sid: '9805dca8-5179-4312-8963-0018248aa315' },
}

async function api(endpoint) {
  const r = await fetch(`https://api.printify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  return r.json()
}

async function main() {
  for (const [num, p] of Object.entries(PRODUCTS)) {
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`  #${num} ${p.name}`)
    console.log(`  Printify: ${p.pid}`)
    console.log(`  Supabase: ${p.sid}`)
    console.log('═'.repeat(70))

    // ── PRINTIFY ──
    const prod = await api(`/shops/${SHOP}/products/${p.pid}.json`)
    
    console.log('\n  [PRINTIFY]')
    console.log(`  Blueprint: ${prod.blueprint_id} | Provider: ${prod.print_provider_id}`)
    console.log(`  Title: ${prod.title}`)
    console.log(`  Status: ${prod.visible ? 'visible' : 'hidden'} | locked: ${prod.is_locked}`)
    console.log(`  Tags: ${(prod.tags || []).join(', ')}`)
    
    // Description
    const desc = (prod.description || '').slice(0, 120)
    console.log(`  Description: ${desc}...`)
    
    // Print areas
    console.log(`  Print areas:`)
    for (const pa of prod.print_areas || []) {
      for (const ph of pa.placeholders || []) {
        for (const img of ph.images || []) {
          if (img.name === 'text_layer.svg') continue
          console.log(`    ${ph.position}: ${img.name} (x:${img.x} y:${img.y} scale:${img.scale})`)
        }
      }
    }
    
    // Variants
    const enabled = prod.variants?.filter(v => v.is_enabled) || []
    const disabled = prod.variants?.filter(v => !v.is_enabled) || []
    console.log(`  Variants: ${enabled.length} enabled, ${disabled.length} disabled`)
    const prices = [...new Set(enabled.map(v => v.price))]
    console.log(`  Prices: ${prices.map(p => p/100 + '€').join(', ')}`)
    
    // Images
    const imgs = (prod.images || []).filter(i => i.src && !i.src.includes('size-chart'))
    const frontImgs = imgs.filter(i => i.src.includes('camera_label=front'))
    const backImgs = imgs.filter(i => i.src.includes('camera_label=back'))
    console.log(`  Mockups: ${imgs.length} total (${frontImgs.length} front, ${backImgs.length} back)`)
    
    // GPSR
    const gpsr = await api(`/shops/${SHOP}/products/${p.pid}/gpsr.json`).catch(() => null)
    if (gpsr) {
      console.log(`  GPSR: manufacturer=${gpsr.manufacturer ? 'YES' : 'NO'}, safety=${gpsr.safety_information ? 'YES' : 'NO'}`)
    } else {
      console.log(`  GPSR: NOT SET`)
    }

    // ── SUPABASE ──
    console.log('\n  [SUPABASE]')
    const { data: sbProd } = await sb.from('products').select('*').eq('id', p.sid).single()
    if (!sbProd) { console.log('  NOT FOUND!'); continue }
    
    console.log(`  Status: ${sbProd.status}`)
    console.log(`  Category: ${sbProd.category}`)
    console.log(`  Price: ${sbProd.base_price_cents/100}€`)
    console.log(`  Images: ${(sbProd.images || []).length}`)
    
    // product_details
    const pd = sbProd.product_details || {}
    console.log(`  product_details:`)
    console.log(`    material: ${pd.material || 'MISSING'}`)
    console.log(`    print_technique: ${pd.print_technique || 'MISSING'}`)
    console.log(`    manufacturing_country: ${pd.manufacturing_country || 'MISSING'}`)
    console.log(`    brand: ${pd.brand || 'MISSING'}`)
    console.log(`    safety_information: ${pd.safety_information ? 'SET (' + pd.safety_information.length + ' chars)' : 'MISSING'}`)
    console.log(`    care_instructions: ${pd.care_instructions || 'MISSING'}`)
    
    // Translations
    const { data: trans } = await sb.from('product_translations')
      .select('locale, title, description')
      .eq('product_id', p.sid)
    console.log(`  Translations: ${(trans || []).map(t => t.locale).join(', ') || 'NONE'}`)
    
    // Variants
    const { data: vars } = await sb.from('product_variants')
      .select('title, color, size, is_enabled, is_available, image_url')
      .eq('product_id', p.sid)
    
    const enabledVars = (vars || []).filter(v => v.is_enabled)
    const withImg = enabledVars.filter(v => v.image_url)
    const frontOnly = withImg.filter(v => v.image_url?.includes('camera_label=front'))
    const backOnly = withImg.filter(v => v.image_url?.includes('camera_label=back'))
    console.log(`  Variants: ${enabledVars.length} enabled`)
    console.log(`  image_url: ${withImg.length} have it (${frontOnly.length} front, ${backOnly.length} back)`)
    
    // Color/size sanity
    const sizeRe = /^(XXS|XS|S|M|L|XL|2XL|3XL|NB|One\s*Size|\d+)/i
    const colors = [...new Set(enabledVars.map(v => v.color))]
    const sizes = [...new Set(enabledVars.map(v => v.size))]
    const badColors = colors.filter(c => sizeRe.test(c))
    const badSizes = sizes.filter(s => s && !sizeRe.test(s) && s !== 'One Size')
    console.log(`  Colors: ${colors.join(', ')}`)
    console.log(`  Sizes: ${sizes.join(', ')}`)
    if (badColors.length) console.log(`  ⚠ SIZES IN COLOR FIELD: ${badColors.join(', ')}`)
    if (badSizes.length) console.log(`  ⚠ COLORS IN SIZE FIELD: ${badSizes.join(', ')}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
