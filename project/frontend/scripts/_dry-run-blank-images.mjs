#!/usr/bin/env node
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf-8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].replace(/["']/g, '').trim() : null }

const token = get('PRINTFUL_API_TOKEN')
const sb = createClient(get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_KEY'))

// Pick one product per unique catalog ID
const { data: products } = await sb
  .from('products')
  .select('id, title, product_template_id')
  .not('product_template_id', 'is', null)
  .eq('status', 'active')

const seen = new Map()
for (const p of products) {
  if (!seen.has(p.product_template_id)) seen.set(p.product_template_id, p)
}

console.log(`${products.length} products, ${seen.size} unique catalog IDs\n`)

for (const [catId, prod] of [...seen.entries()].slice(0, 3)) {
  console.log(`--- Catalog ${catId}: ${prod.title}`)

  // Our variant colors
  const { data: variants } = await sb
    .from('product_variants')
    .select('color')
    .eq('product_id', prod.id)
    .eq('is_enabled', true)

  const ourColors = [...new Set(variants.map(v => (v.color || '').toLowerCase()).filter(Boolean))]
  console.log(`  Our colors (${ourColors.length}):`, ourColors.join(', '))

  // Printful catalog colors
  const res = await fetch(`https://api.printful.com/products/${catId}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'POD-AI-Store/1.0' }
  })
  const data = await res.json()
  const cvs = data.result?.variants || []
  const catColors = new Map()
  for (const cv of cvs) {
    if (cv.color && cv.image && !catColors.has(cv.color.toLowerCase())) {
      catColors.set(cv.color.toLowerCase(), { image: cv.image, hex: cv.color_code })
    }
  }
  console.log(`  Catalog colors (${catColors.size}):`, [...catColors.keys()].join(', '))

  let matches = 0, misses = 0
  for (const c of ourColors) {
    if (catColors.has(c)) { matches++ }
    else { misses++; console.log(`  MISS: "${c}"`) }
  }
  console.log(`  Result: ${matches} matches, ${misses} misses\n`)

  await new Promise(r => setTimeout(r, 1500))
}
