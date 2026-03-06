/**
 * Inspect a Printify product — shows full details including positioning, variants, GPSR status.
 * Usage: node scripts/_inspect-product.mjs <printify_product_id>
 *        node scripts/_inspect-product.mjs --all   (inspects all batch 1 products)
 */
import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}` }

const BATCH1_IDS = [
  '69a2f7c19f7e893e8a0e0911', // Absolutely Right
  '69a2f7d7eb470f86b105afcd', // Vibe Coder
  '69a2f7e99f7e893e8a0e0923', // Zero Bugs
  '69a2f7f9874d66e74c0e816e', // Ghost Tee
  '69a2f809414758b6c602d4ff', // Shadow Tee
  '69a2f8191ec5ca402c033364', // Prism Tee
]

async function fetchJSON(url) {
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r.json()
}

async function inspect(productId) {
  const p = await fetchJSON(`${API}/shops/${SHOP_ID}/products/${productId}.json`)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${p.title}`)
  console.log(`  Printify ID: ${p.id}`)
  console.log(`${'═'.repeat(60)}`)

  // Basic info
  console.log(`  Blueprint: ${p.blueprint_id} | Provider: ${p.print_provider_id}`)
  console.log(`  Status: ${p.visible ? 'visible' : 'hidden'} | Published: ${p.is_locked ? 'locked' : 'unlocked'}`)
  console.log(`  Tags: ${(p.tags || []).join(', ')}`)
  console.log(`  Description: ${(p.description || '').substring(0, 120)}...`)

  // Variants
  const enabled = (p.variants || []).filter(v => v.is_enabled)
  const colors = [...new Set(enabled.map(v => v.title.split('/')[0]?.trim()))]
  const sizes = [...new Set(enabled.map(v => v.title.split('/')[1]?.trim()))]
  console.log(`\n  VARIANTS (${enabled.length} enabled / ${(p.variants || []).length} total):`)
  console.log(`    Colors: ${colors.join(', ')}`)
  console.log(`    Sizes: ${sizes.join(', ')}`)
  for (const v of enabled.slice(0, 3)) {
    console.log(`    Sample: id=${v.id} "${v.title}" price=${v.price} sku=${v.sku || 'none'}`)
  }

  // Print areas — positioning
  console.log(`\n  PRINT AREAS:`)
  for (const pa of (p.print_areas || [])) {
    console.log(`    variant_ids: ${pa.variant_ids?.length || 0}`)
    for (const ph of (pa.placeholders || [])) {
      console.log(`    Position: ${ph.position}`)
      for (const img of (ph.images || [])) {
        console.log(`      Image: id=${img.id}`)
        console.log(`      x=${img.x} y=${img.y} scale=${img.scale} angle=${img.angle}`)
      }
    }
  }

  // Images / Mockups
  const imgs = (p.images || []).filter(i => i.src)
  console.log(`\n  MOCKUP IMAGES: ${imgs.length}`)
  for (const img of imgs.slice(0, 3)) {
    console.log(`    ${img.src?.substring(0, 80)}...`)
    console.log(`    variant_ids: ${(img.variant_ids || []).slice(0, 3).join(', ')}${(img.variant_ids || []).length > 3 ? '...' : ''}`)
  }

  // GPSR / Sales channel info
  console.log(`\n  SALES CHANNEL: ${p.sales_channel_properties ? JSON.stringify(p.sales_channel_properties).substring(0, 200) : 'none'}`)

  // Check for any extra fields
  const knownKeys = ['id', 'title', 'description', 'tags', 'options', 'variants', 'images', 'created_at', 'updated_at', 'visible', 'is_locked', 'blueprint_id', 'print_provider_id', 'print_areas', 'sales_channel_properties', 'user_id', 'shop_id', 'print_details', 'external']
  const extraKeys = Object.keys(p).filter(k => !knownKeys.includes(k))
  if (extraKeys.length > 0) {
    console.log(`\n  EXTRA FIELDS: ${extraKeys.join(', ')}`)
    for (const k of extraKeys) {
      console.log(`    ${k}: ${JSON.stringify(p[k]).substring(0, 200)}`)
    }
  }
}

async function main() {
  const arg = process.argv[2]
  const ids = arg === '--all' ? BATCH1_IDS : [arg || BATCH1_IDS[0]]

  for (const id of ids) {
    try {
      await inspect(id)
    } catch (e) {
      console.error(`  ERROR inspecting ${id}: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 500))
  }
}

main().catch(e => console.error('FATAL:', e.message))
