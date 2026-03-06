/**
 * Sync DB with Printify — find and remove orphaned products
 * Step 1: List all Printify product IDs
 * Step 2: Find Supabase products not in Printify
 * Step 3: Delete orphans (variants + products)
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  console.log('═'.repeat(60))
  console.log('  SYNC DB ↔ PRINTIFY')
  console.log('═'.repeat(60))

  // 1. Get all Printify product IDs
  console.log('\n  Fetching Printify products...')
  const printifyIds = new Set()
  let page = 1
  while (true) {
    const r = await fetch(`${API}/shops/${SHOP}/products.json?page=${page}&limit=50`, { headers: hdrs })
    const data = await r.json()
    if (!data.data || data.data.length === 0) break
    for (const p of data.data) printifyIds.add(p.id)
    if (page >= (data.last_page || 1)) break
    page++
    await delay(500)
  }
  console.log(`  Printify: ${printifyIds.size} products`)

  // 2. Get all Supabase products
  const { data: sbProducts } = await sb.from('products')
    .select('id, title, printify_id')
    .order('title')
  console.log(`  Supabase: ${sbProducts.length} products`)

  // 3. Find orphans
  const orphans = sbProducts.filter(p => !printifyIds.has(p.printify_id))
  const valid = sbProducts.filter(p => printifyIds.has(p.printify_id))

  console.log(`\n  ✅ Valid (in both): ${valid.length}`)
  console.log(`  👻 Orphaned (DB only): ${orphans.length}`)

  if (orphans.length === 0) {
    console.log('\n  No orphans found. DB is in sync.')
    return
  }

  console.log('\n  ORPHANED PRODUCTS (will be deleted):')
  console.log('  ' + '─'.repeat(56))
  for (const o of orphans) {
    console.log(`    ${o.title}`)
    console.log(`      DB id: ${o.id} | printify_id: ${o.printify_id}`)
  }

  // 4. Delete orphans
  console.log('\n  Deleting orphans...')
  for (const o of orphans) {
    // Delete variants first (FK constraint)
    const { count: varCount } = await sb.from('product_variants')
      .delete({ count: 'exact' })
      .eq('product_id', o.id)

    // Delete from wishlist_items if any
    await sb.from('wishlist_items').delete().eq('product_id', o.id)

    // Delete from cart_items if any
    await sb.from('cart_items').delete().eq('product_id', o.id)

    // Delete from reviews if any
    await sb.from('reviews').delete().eq('product_id', o.id)

    // Delete product
    const { error } = await sb.from('products').delete().eq('id', o.id)
    if (error) {
      console.log(`    ❌ ${o.title}: ${error.message}`)
    } else {
      console.log(`    ✓ ${o.title} (${varCount || 0} variants removed)`)
    }
  }

  // 5. Verify
  const { count } = await sb.from('products').select('id', { count: 'exact', head: true })
  console.log(`\n  After cleanup: ${count} products in Supabase (Printify: ${printifyIds.size})`)

  console.log('\n' + '═'.repeat(60))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
