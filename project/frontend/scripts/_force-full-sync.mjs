/**
 * Force Full Sync — Printify → Supabase
 * Uses the same normalization as printify-sync.ts but runs locally.
 * Fixes: duplicate images, string-format images, orphaned products, missing variants.
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
const USD_TO_EUR = 0.92

// ─── Fetch all Printify products ────────────────────────────────────────────
async function fetchAllPrintify() {
  const all = []
  let page = 1
  while (true) {
    const r = await fetch(`${API}/shops/${SHOP}/products.json?page=${page}&limit=50`, { headers: hdrs })
    const data = await r.json()
    if (!data.data || data.data.length === 0) break
    all.push(...data.data)
    if (page >= (data.last_page || 1)) break
    page++
    await delay(500)
  }
  return all
}

// ─── Normalize images: deduplicate, filter size-charts, object format ───────
function normalizeImages(rawImages, title) {
  const seen = new Set()
  return (rawImages || [])
    .map(img => {
      const src = String(img.src || img.url || '')
      if (!src || src.includes('size-chart') || src.includes('size_chart')) return null
      const base = src.split('?')[0]
      if (seen.has(base)) return null
      seen.add(base)
      const variantIds = Array.isArray(img.variant_ids) ? img.variant_ids : []
      return { src, alt: title, variant_ids: variantIds, is_default: img.is_default === true }
    })
    .filter(Boolean)
}

// ─── Category inference (mirrors printify-sync.ts) ──────────────────────────
function inferCategorySlug(title) {
  const t = title.toLowerCase()
  if (['journal', 'diary'].some(k => t.includes(k))) return 'journals'
  if (['notebook', 'notepad'].some(k => t.includes(k))) return 'notebooks'
  if (['canvas print', 'canvas'].some(k => t.includes(k))) return 'canvas'
  if (['blanket', 'throw blanket'].some(k => t.includes(k))) return 'blankets'
  if (['pillow', 'cushion'].some(k => t.includes(k))) return 'pillows'
  if (['poster', 'print', 'wall art'].some(k => t.includes(k))) return 'posters'
  if (['mug', 'cup'].some(k => t.includes(k))) return 'mugs'
  if (['tumbler'].some(k => t.includes(k))) return 'tumblers'
  if (['bottle', 'water bottle'].some(k => t.includes(k))) return 'bottles'
  if (['sticker', 'decal'].some(k => t.includes(k))) return 'stickers'
  if (['phone case', 'iphone'].some(k => t.includes(k))) return 'phone-cases'
  if (['mouse pad', 'mousepad'].some(k => t.includes(k))) return 'mouse-pads'
  if (['desk mat', 'gaming mat', 'desk pad'].some(k => t.includes(k))) return 'desk-mats'
  if (['long sleeve', 'longsleeve'].some(k => t.includes(k))) return 'long-sleeves'
  if (['tank top'].some(k => t.includes(k))) return 'tank-tops'
  if (['zip-up hoodie', 'zip hoodie', 'zip up hoodie', 'zip-up'].some(k => t.includes(k))) return 'zip-hoodies'
  if (['hoodie', 'pullover hoodie', 'pullover'].some(k => t.includes(k))) return 'pullover-hoodies'
  if (['crewneck', 'crew neck', 'sweatshirt', 'sweater'].some(k => t.includes(k))) return 'crewnecks'
  if (['t-shirt', 'tee', 'tshirt'].some(k => t.includes(k))) return 't-shirts'
  if (['beanie'].some(k => t.includes(k))) return 'beanies'
  if (['bucket hat'].some(k => t.includes(k))) return 'bucket-hats'
  if (['snapback'].some(k => t.includes(k))) return 'snapbacks'
  if (['dad hat', 'dad cap'].some(k => t.includes(k))) return 'dad-hats'
  if (['5-panel', '5 panel'].some(k => t.includes(k))) return '5-panel-caps'
  if (['hat', 'cap'].some(k => t.includes(k))) return 'caps'
  if (['shoe', 'sneaker', 'trainer'].some(k => t.includes(k))) return 'sneakers'
  if (['tote', 'bag', 'backpack'].some(k => t.includes(k))) return 'bags'
  return 'accessories'
}

// ─── Variant parsing (mirrors printify-sync.ts) ─────────────────────────────
const SIZE_RE = /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|2X|3X|4X|5X|S\/M|L\/XL|One\s*size|\d+oz|\d+x\d+|\d+['"]?x\d+['"]?|\d+(\.\d+)?["']\s*x\s*\d+(\.\d+)?["']?|\d+(\.\d+)?["'])$/i

function parseVariant(v, productId, variantImageMap) {
  const variantId = Number(v.id || 0)
  const title = String(v.title || '')
  const parts = title.split(' / ').map(p => p.trim())
  let size = null, color = null

  if (parts.length >= 3) {
    const last = parts[parts.length - 1]
    if (SIZE_RE.test(last)) { color = parts.slice(0, -1).join(' / '); size = last }
    else { color = parts[0]; size = parts[1] }
  } else if (parts.length === 2) {
    if (SIZE_RE.test(parts[0]) && !SIZE_RE.test(parts[1])) { size = parts[0]; color = parts[1] }
    else { color = parts[0]; size = parts[1] }
  } else {
    if (SIZE_RE.test(parts[0] || '')) size = parts[0]
    else color = parts[0] || null
  }

  const costUsd = Number(v.cost || 0)
  return {
    product_id: productId,
    printify_variant_id: String(variantId),
    title, size, color,
    price_cents: Number(v.price || 0) || null,
    cost_cents: costUsd > 0 ? Math.round(costUsd * USD_TO_EUR) : null,
    sku: String(v.sku || ''),
    is_enabled: v.is_enabled !== false,
    is_available: v.is_available !== false,
    image_url: variantImageMap.get(variantId) || null,
  }
}

async function main() {
  console.log('═'.repeat(70))
  console.log('  FORCE FULL SYNC — Printify → Supabase')
  console.log('═'.repeat(70))

  const printifyProducts = await fetchAllPrintify()
  console.log(`  Printify: ${printifyProducts.length} products`)

  const { data: sbProducts } = await sb.from('products').select('id, printify_id, title, status, images')
  const { data: sbVariants } = await sb.from('product_variants').select('id, product_id, printify_variant_id')
  console.log(`  Supabase: ${sbProducts.length} products, ${sbVariants.length} variants`)

  const sbMap = new Map()
  for (const p of sbProducts) if (p.printify_id) sbMap.set(p.printify_id, p)

  const sbVarsByProduct = new Map()
  for (const v of sbVariants) {
    if (!sbVarsByProduct.has(v.product_id)) sbVarsByProduct.set(v.product_id, [])
    sbVarsByProduct.get(v.product_id).push(v)
  }

  // Preload category IDs
  const { data: categories } = await sb.from('categories').select('id, slug')
  const catMap = new Map()
  for (const c of categories || []) catMap.set(c.slug, c.id)

  const report = { synced: 0, created: 0, orphaned: 0, imagesFixed: 0, variantsAdded: 0, variantsRemoved: 0, errors: [] }

  // ─── Sync each Printify product ───────────────────────────────────────
  const printifyIds = new Set()
  for (const [idx, pp] of printifyProducts.entries()) {
    const pid = String(pp.id)
    printifyIds.add(pid)
    const title = String(pp.title || 'Untitled')
    const label = `[${idx + 1}/${printifyProducts.length}]`

    // Normalize images
    const images = normalizeImages(pp.images || [], title)

    // Variants
    const ppVariants = (pp.variants || []).filter(v => v.is_enabled !== false)
    const variantImageMap = new Map()
    for (const img of (pp.images || [])) {
      const src = String(img.src || img.url || '')
      for (const vid of (img.variant_ids || [])) {
        if (!variantImageMap.has(vid)) variantImageMap.set(vid, src)
      }
    }

    // Pricing
    const costs = ppVariants.map(v => Number(v.cost || 0)).filter(c => c > 0)
    const minCostUsd = costs.length ? Math.min(...costs) : 0
    const costEur = minCostUsd ? Math.round(minCostUsd * USD_TO_EUR) : 0
    const prices = ppVariants.map(v => Number(v.price || 0)).filter(p => p > 0)
    const basePrice = prices.length ? Math.min(...prices) : 2999

    const catSlug = inferCategorySlug(title)
    const catId = catMap.get(catSlug) || null
    const status = pp.visible ? 'active' : 'draft'

    const existing = sbMap.get(pid)

    if (existing) {
      // Update existing product
      const oldImages = Array.isArray(existing.images) ? existing.images : []
      const oldIsStrings = oldImages.length > 0 && typeof oldImages[0] === 'string'
      const hadDuplicates = oldImages.length > images.length + 2

      const { error } = await sb.from('products').update({
        images,
        status: existing.status === 'deleted' ? 'deleted' : status,
        base_price_cents: basePrice,
        cost_cents: costEur || null,
        category_id: catId,
        blueprint_id: pp.blueprint_id || null,
        print_provider_id: pp.print_provider_id || null,
        last_synced_at: new Date().toISOString(),
      }).eq('id', existing.id)

      if (error) {
        console.log(`  ${label} ❌ ${title}: ${error.message}`)
        report.errors.push(`${title}: ${error.message}`)
      } else {
        const tag = (oldIsStrings || hadDuplicates || oldImages.length === 0) ? ' (images fixed)' : ''
        if (tag) report.imagesFixed++
        console.log(`  ${label} ✓ ${title.substring(0, 45).padEnd(45)} imgs:${oldImages.length}→${images.length}${tag}`)
        report.synced++
      }

      // Sync variants
      const myVars = sbVarsByProduct.get(existing.id) || []
      const myVarIds = new Set(myVars.map(v => String(v.printify_variant_id)))
      const ppVarIds = new Set(ppVariants.map(v => String(v.id)))

      // Add missing variants
      const missing = ppVariants.filter(v => !myVarIds.has(String(v.id)))
      if (missing.length > 0) {
        const rows = missing.map(v => parseVariant(v, existing.id, variantImageMap))
        const { error: vErr } = await sb.from('product_variants').upsert(rows, { onConflict: 'product_id,printify_variant_id' })
        if (!vErr) {
          report.variantsAdded += missing.length
          console.log(`    +${missing.length} variants added`)
        }
      }

      // Remove disabled variants
      const extra = myVars.filter(v => !ppVarIds.has(String(v.printify_variant_id)))
      if (extra.length > 0) {
        for (const v of extra) {
          await sb.from('product_variants').delete().eq('id', v.id)
        }
        report.variantsRemoved += extra.length
        console.log(`    -${extra.length} variants removed`)
      }
    } else {
      // Create new product
      const { data: created, error } = await sb.from('products').upsert({
        printify_id: pid,
        title,
        description: String(pp.description || '').slice(0, 2000),
        images,
        status,
        currency: 'EUR',
        cost_cents: costEur || null,
        base_price_cents: basePrice,
        category_id: catId,
        blueprint_id: pp.blueprint_id || null,
        print_provider_id: pp.print_provider_id || null,
        last_synced_at: new Date().toISOString(),
        ...(pp.visible ? { published_at: new Date().toISOString() } : {}),
      }, { onConflict: 'printify_id' }).select('id')

      if (error) {
        console.log(`  ${label} ❌ NEW ${title}: ${error.message}`)
        report.errors.push(`NEW ${title}: ${error.message}`)
      } else {
        console.log(`  ${label} ✚ ${title} (new)`)
        report.created++

        // Add variants
        if (created?.[0]?.id && ppVariants.length > 0) {
          const rows = ppVariants.map(v => parseVariant(v, created[0].id, variantImageMap))
          await sb.from('product_variants').upsert(rows, { onConflict: 'product_id,printify_variant_id' })
          report.variantsAdded += rows.length
        }
      }
    }
  }

  // ─── Mark orphans ─────────────────────────────────────────────────────
  for (const [pid, sp] of sbMap) {
    if (!printifyIds.has(pid) && sp.status !== 'deleted') {
      const { error } = await sb.from('products').update({ status: 'deleted' }).eq('id', sp.id)
      if (!error) {
        console.log(`  🗑 ORPHAN → deleted: ${sp.title}`)
        report.orphaned++
      }
    }
  }

  // ─── Report ───────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('  SYNC COMPLETE')
  console.log(`    Synced:          ${report.synced}`)
  console.log(`    Created:         ${report.created}`)
  console.log(`    Orphaned:        ${report.orphaned}`)
  console.log(`    Images fixed:    ${report.imagesFixed}`)
  console.log(`    Variants added:  ${report.variantsAdded}`)
  console.log(`    Variants removed:${report.variantsRemoved}`)
  console.log(`    Errors:          ${report.errors.length}`)
  if (report.errors.length > 0) {
    for (const e of report.errors) console.log(`      ❌ ${e}`)
  }
  console.log('═'.repeat(70))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
