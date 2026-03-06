/**
 * Fix Phase 1 prices — multi-position printing costs more than expected.
 * Updates prices on BOTH Printify (variant prices) and Supabase (base_price_cents).
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const supabase = createClient(SB_URL, SB_KEY)

// New prices for 40%+ margin on multi-position products
const PRICE_FIXES = {
  6:    { newPrice: 3799, label: 'T-Shirt €37.99' },     // was 2999, cost=2274
  77:   { newPrice: 6099, label: 'Hoodie €60.99' },       // was 5299, cost=3653
  49:   { newPrice: 5099, label: 'Crewneck €50.99' },     // was 4499, cost=3013
  80:   { newPrice: 4499, label: 'Long Sleeve €44.99' },  // was 3499, cost=2667
  // 1018 (Mug) and 1744 (Cap) are fine — no change
}

console.log('='.repeat(65))
console.log('  PHASE 1 — PRICE FIX (Printify + Supabase)')
console.log('  Adjusting for multi-position printing costs')
console.log('='.repeat(65) + '\n')

// Get phase 1 products from Supabase
const phase1Names = [
  'Soup Fork', 'Existential Dread', 'Social Battery', 'Plans Cancelled',
  'Self-Care Mode', 'Caffeine Anxiety', 'Next Line', 'Just For You',
  'Hang In There', 'Nervous System', 'Main Character', 'Nope',
  'Loading Motivation', '404 Purpose', 'New 2016',
  'On Mute', 'On Demand',
]

const { data: products } = await supabase
  .from('products')
  .select('id, title, printify_id, blueprint_id, base_price_cents')
  .in('title', phase1Names)

console.log(`  Found ${products.length} products to fix\n`)

let fixed = 0, skipped = 0

for (const prod of products) {
  const fix = PRICE_FIXES[prod.blueprint_id]
  if (!fix) {
    console.log(`  SKIP ${prod.title} (BP${prod.blueprint_id}) — price OK`)
    skipped++
    continue
  }

  console.log(`  FIX ${prod.title} (BP${prod.blueprint_id})`)
  console.log(`      ${prod.base_price_cents} → ${fix.newPrice} cents (${fix.label})`)

  // 1. Update Printify variant prices
  await delay(2000)
  try {
    // Get current product to know variant IDs
    const r = await fetch(`${API}/shops/${SHOP_ID}/products/${prod.printify_id}.json`, { headers: hdrs })
    if (!r.ok) throw new Error(`GET ${r.status}`)
    const pData = await r.json()

    const updatedVariants = (pData.variants || []).map(v => ({
      id: v.id,
      price: fix.newPrice,
      is_enabled: v.is_enabled,
    }))

    await delay(1500)
    const patchR = await fetch(`${API}/shops/${SHOP_ID}/products/${prod.printify_id}.json`, {
      method: 'PUT',
      headers: hdrs,
      body: JSON.stringify({
        title: pData.title,
        variants: updatedVariants,
      }),
    })
    if (!patchR.ok) {
      const body = await patchR.text()
      throw new Error(`PUT ${patchR.status}: ${body.slice(0, 200)}`)
    }
    console.log(`      Printify: ${updatedVariants.length} variant prices updated`)

    // Re-publish to reflect new prices
    await delay(1500)
    await fetch(`${API}/shops/${SHOP_ID}/products/${prod.printify_id}/publish.json`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
    })
    console.log(`      Printify: re-published`)

  } catch (e) {
    console.log(`      Printify ERROR: ${e.message}`)
  }

  // 2. Update Supabase base_price_cents
  const { error: dbErr } = await supabase
    .from('products')
    .update({ base_price_cents: fix.newPrice })
    .eq('id', prod.id)
  if (dbErr) {
    console.log(`      Supabase ERROR: ${dbErr.message}`)
  } else {
    console.log(`      Supabase: base_price_cents updated`)
  }

  // 3. Update Supabase product_variants prices
  const { error: vErr } = await supabase
    .from('product_variants')
    .update({ price_cents: fix.newPrice })
    .eq('product_id', prod.id)
  if (vErr) {
    console.log(`      Variants ERROR: ${vErr.message}`)
  } else {
    console.log(`      Variants: price_cents updated`)
  }

  fixed++
  console.log('')
}

console.log('='.repeat(65))
console.log(`  DONE: ${fixed} fixed, ${skipped} skipped (already OK)`)
console.log('='.repeat(65))
