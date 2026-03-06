import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const NEW_IDS = {
  2: { name: 'Bug Reporter',    pid: '69a39a529f7e893e8a0e2aeb', sid: 'c53017eb-9ef4-4432-867d-d8c8a37e9c95' },
  3: { name: 'Sudo Ice Cream',  pid: '69a39a76339f8a44c50de734', sid: '84e01ffc-68c9-4151-b5cf-3a98e4cf28ee' },
  4: { name: 'Bedtime 404',     pid: '69a39a983f0e39248902b348', sid: 'd27d9e55-f50f-43ce-92ae-4ff8d9a936af' },
  5: { name: 'Ctrl+Z Homework', pid: '69a39ab83b12a90c8e089501', sid: 'cce5134c-b444-4be9-8d62-5bb22e28858d' },
  6: { name: 'AI Raised Me',    pid: '69a39adba5dcb1b9a904a2df', sid: '756fc09b-8ad8-4a6a-a422-e09fd92af24d' },
  7: { name: 'Code Works',      pid: '69a39b00a76c862bc906bb58', sid: 'c0036a6e-f697-4ac1-bee2-8a2433127650' },
}

const SIZE_RE = /^(XXS|XS|S|M|L|XL|2XL|3XL|NB|One\s*Size|\d+)/i
let issues = 0

for (const [num, p] of Object.entries(NEW_IDS)) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  #${num} ${p.name}`)
  console.log('═'.repeat(60))

  // Printify
  const r = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products/${p.pid}.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  const prod = await r.json()
  
  // Print areas
  const positions = []
  for (const pa of prod.print_areas || []) {
    for (const ph of pa.placeholders || []) {
      for (const img of ph.images || []) {
        if (img.name === 'text_layer.svg') continue
        positions.push(`${ph.position}(${img.x},${img.y},${img.scale})`)
      }
    }
  }
  console.log(`  Printify positions: ${positions.join(' | ')}`)
  
  // GPSR
  const gr = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products/${p.pid}/gpsr.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  const gpsr = await gr.json()
  const hasGpsr = gpsr.safety_information || gpsr.manufacturer
  console.log(`  GPSR: ${hasGpsr ? 'SET' : 'NOT SET'}`)
  if (!hasGpsr) issues++

  // Supabase
  const { data: sbProd } = await sb.from('products').select('category, category_id, translations, product_details, images').eq('id', p.sid).single()
  
  console.log(`  Category: ${sbProd.category || 'NULL'}`)
  if (!sbProd.category) issues++
  
  const trans = sbProd.translations || {}
  const hasEs = trans.es?.description ? 'YES' : 'NO'
  const hasDe = trans.de?.description ? 'YES' : 'NO'
  console.log(`  Translations: es=${hasEs} de=${hasDe}`)
  if (hasEs === 'NO' || hasDe === 'NO') issues++
  
  const pd = sbProd.product_details || {}
  const metaOk = pd.material && pd.brand && pd.safety_information && pd.manufacturing_country
  console.log(`  Metadata: ${metaOk ? 'COMPLETE' : 'INCOMPLETE'}`)
  if (!metaOk) issues++

  // Images
  const imgs = sbProd.images || []
  const firstLabel = (imgs[0]?.src || '').match(/camera_label=([^&]+)/)?.[1] || 'unknown'
  console.log(`  Images: ${imgs.length} (card=${firstLabel})`)
  if (firstLabel !== 'front') issues++

  // Variants
  const { data: vars } = await sb.from('product_variants')
    .select('color, size, image_url, is_enabled')
    .eq('product_id', p.sid)
    .eq('is_enabled', true)
  
  const colors = [...new Set(vars.map(v => v.color))]
  const sizes = [...new Set(vars.map(v => v.size))]
  const withImg = vars.filter(v => v.image_url)
  const backImg = vars.filter(v => v.image_url?.includes('camera_label=back'))
  
  // Use the CORRECTED regex with $ anchor to check
  const CORRECT_SIZE_RE = /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|2XS|S\/M|L\/XL|NB|One\s*size|US\s+\d+(?:\.\d+)?|\d+.*)$/i
  const badColors = colors.filter(c => CORRECT_SIZE_RE.test(c))
  
  console.log(`  Variants: ${vars.length} (${withImg.length} with image, ${backImg.length} pointing to back)`)
  console.log(`  Colors: ${colors.join(', ')}`)
  console.log(`  Sizes: ${sizes.join(', ')}`)
  if (badColors.length) { console.log(`  ⚠ SWAPPED: ${badColors.join(', ')}`); issues++ }
  if (backImg.length) { console.log(`  ⚠ ${backImg.length} variants point to BACK`); issues++ }
}

console.log(`\n${'═'.repeat(60)}`)
console.log(`  VERIFICATION: ${issues === 0 ? 'ALL CHECKS PASSED' : `${issues} ISSUES FOUND`}`)
console.log('═'.repeat(60))
