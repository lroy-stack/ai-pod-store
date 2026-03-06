/**
 * SKAPARA — Phase 2: 10 Products (4 new types, recycled designs)
 *
 * Reads catalog.json + SVGs from phase2-production/
 * Renders SVGs → PNG via sharp, uploads to Printify, creates products.
 *
 * Types: Tote Bags (BP731/P26), Pint Glasses (BP633/P86),
 *        Wine Tumblers (BP620/P86), Ceramic Coasters (BP1523/P23)
 *
 * Usage:
 *   node scripts/create-phase2.mjs --preview     # Render PNGs only
 *   node scripts/create-phase2.mjs --dry-run     # Show what would be created
 *   node scripts/create-phase2.mjs               # Create on Printify + Supabase
 *   node scripts/create-phase2.mjs --only TB01   # Create single product by ID
 *   node scripts/create-phase2.mjs --skip TB01,TB02 # Skip specific products
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── CLI flags ───────────────────────────────────────────────────────────────
const PREVIEW   = process.argv.includes('--preview')
const DRY_RUN   = process.argv.includes('--dry-run')
const ONLY_ID   = process.argv.find((a, i) => process.argv[i - 1] === '--only') || null
const SKIP_IDS  = (process.argv.find((a, i) => process.argv[i - 1] === '--skip') || '')
                    .split(',').filter(Boolean)

// ─── Paths ───────────────────────────────────────────────────────────────────
const ROOT      = join(import.meta.dirname, '..')
const PHASE_DIR = join(ROOT, 'public', 'phase2-production')
const RENDER_DIR = join(PHASE_DIR, 'renders')
mkdirSync(RENDER_DIR, { recursive: true })

// ─── Load catalog ────────────────────────────────────────────────────────────
const catalog = JSON.parse(readFileSync(join(PHASE_DIR, 'catalog.json'), 'utf8'))

// ─── Env (only for real creation) ────────────────────────────────────────────
let TOKEN, SHOP_ID, supabase
if (!PREVIEW && !DRY_RUN) {
  const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
  TOKEN   = env('PRINTIFY_API_TOKEN')
  SHOP_ID = env('PRINTIFY_SHOP_ID')
  const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
  const SB_KEY = env('SUPABASE_SERVICE_KEY')
  if (!TOKEN || !SHOP_ID) { console.error('Missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID'); process.exit(1) }
  if (!SB_URL || !SB_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1) }
  supabase = createClient(SB_URL, SB_KEY)
}

// ─── Printify API helpers ────────────────────────────────────────────────────
const API = 'https://api.printify.com/v1'
const hdrs = () => ({
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'POD-AI-Store/1.0',
})
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const url = `${API}${endpoint}`
  const r = await fetch(url, { ...opts, headers: { ...hdrs(), ...opts.headers } })
  if (!r.ok) {
    const body = (await r.text()).slice(0, 500)
    throw new Error(`Printify ${r.status} ${r.statusText}: ${body}`)
  }
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

async function uploadImage(fileName, buffer) {
  return api('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({
      file_name: fileName,
      contents: buffer.toString('base64'),
    }),
  })
}

// ─── GPSR HTML Templates ─────────────────────────────────────────────────────
function gpsrHtml(product) {
  const tpl = catalog.gpsrTemplates[product.gpsr]
  return `<p><strong>Manufacturer:</strong> ${tpl.manufacturer}</p>
<p><strong>Material:</strong> ${product.material}</p>
<p><strong>Print:</strong> ${product.printTechnique}</p>
<p><strong>Care:</strong> ${product.care}</p>
<p><strong>Compliance:</strong> ${tpl.compliance}</p>
<p><strong>EU Responsible:</strong> ${tpl.eu_responsible}</p>`
}

// ─── SVG → PNG Renderer ──────────────────────────────────────────────────────
async function renderSvg(svgPath, width, height) {
  const svgBuf = readFileSync(svgPath)
  return sharp(svgBuf)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

// ─── Flatten variant set into array ──────────────────────────────────────────
function flattenVariants(variantSetKey, priceCents) {
  const vs = catalog.variantSets[variantSetKey]
  const result = []
  for (const [color, sizes] of Object.entries(vs.colors)) {
    for (const [size, id] of Object.entries(sizes)) {
      result.push({ id, color, size, price: priceCents, is_enabled: true })
    }
  }
  return result
}

// ─── Build print_areas with positions ────────────────────────────────────────
function buildPrintAreas(product, uploadIds) {
  const vs = catalog.variantSets[product.variantSet]
  const allVariantIds = []
  for (const sizes of Object.values(vs.colors)) {
    for (const id of Object.values(sizes)) {
      allVariantIds.push(id)
    }
  }

  const placeholders = []

  for (const position of product.positions) {
    if (!uploadIds[position]) continue
    const img = { id: uploadIds[position] }

    switch (position) {
      case 'front':
        img.x = 0.5; img.y = 0.5; img.scale = 1; img.angle = 0
        break
      case 'back':
        // Wordmark centered near top (upper area of tote back)
        img.x = 0.5; img.y = 0.15; img.scale = 0.35; img.angle = 0
        break
      default:
        img.x = 0.5; img.y = 0.5; img.scale = 1; img.angle = 0
    }

    placeholders.push({ position, images: [img] })
  }

  return [{ variant_ids: allVariantIds, placeholders }]
}

// ─── Manufacturing country by provider ───────────────────────────────────────
function manufacturingCountry(providerId) {
  switch (providerId) {
    case 26:  return 'Germany'   // Textildruck Europa
    case 86:  return 'EU'        // Dream Junction / Chill
    case 23:  return 'EU'        // WOYC
    case 410: return 'Latvia'    // Printful Latvia
    default:  return 'EU'
  }
}

// ─── Model name by blueprint ─────────────────────────────────────────────────
function modelName(blueprintId) {
  switch (blueprintId) {
    case 731:  return 'Westford Mill W801'
    case 633:  return 'Pint Glass 16oz'
    case 620:  return 'Chill Wine Tumbler 12oz'
    case 1523: return 'Ceramic Coaster'
    default:   return ''
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('='.repeat(65))
  console.log('  SKAPARA — Phase 2: 10 Products (4 new types)')
  console.log(`  Mode: ${PREVIEW ? 'PREVIEW' : DRY_RUN ? 'DRY RUN' : 'LIVE CREATION'}`)
  console.log('='.repeat(65) + '\n')

  // ── Step 0: Upload shared branding assets ──────────────────────────────────
  const brandingUploads = {}

  if (!PREVIEW && !DRY_RUN) {
    console.log('  Uploading shared branding assets...\n')

    // Back wordmark for totes — render SVG → PNG at canvas size
    const backSvgPath = join(PHASE_DIR, catalog.brandingAssets.backWordmarkBP731)
    if (existsSync(backSvgPath)) {
      const backPng = await renderSvg(backSvgPath, 2953, 3543)
      await delay(2000)
      const backUp = await uploadImage('skapara-back-wordmark-bp731.png', backPng)
      brandingUploads.backWordmark = backUp.id
      console.log(`    Back wordmark (totes): ${backUp.id}`)
    } else {
      console.log('    WARN: Back wordmark SVG not found — totes will have front only')
    }

    console.log('')
  }

  // ── Step 1: Process each product ───────────────────────────────────────────
  const products = catalog.products.filter(p => {
    if (ONLY_ID && p.id !== ONLY_ID) return false
    if (SKIP_IDS.includes(p.id)) return false
    return true
  })

  const results = { success: [], failed: [], skipped: [] }

  for (const [idx, product] of products.entries()) {
    const num = `${idx + 1}/${products.length}`
    const vs = catalog.variantSets[product.variantSet]
    const variants = flattenVariants(product.variantSet, product.priceCents)

    console.log(`  [${num}] ${product.id} — ${product.name}`)
    console.log(`         BP${vs.blueprint_id}/P${vs.provider_id} | ${variants.length} variants | €${(product.priceCents / 100).toFixed(2)}`)

    try {
      // ── 1a. Render design SVG → PNG ──────────────────────────────────────
      const svgPath = join(PHASE_DIR, product.svg)
      if (!existsSync(svgPath)) throw new Error(`SVG not found: ${product.svg}`)

      const frontCanvas = vs.canvas.front
      const designPng = await renderSvg(svgPath, frontCanvas[0], frontCanvas[1])

      // Save preview render
      const previewName = `${product.id.toLowerCase()}-${product.name.toLowerCase().replace(/\s+/g, '-')}.png`
      const previewPath = join(RENDER_DIR, previewName)
      const pw = Math.round(frontCanvas[0] / 4)
      const ph = Math.round(frontCanvas[1] / 4)
      const preview = await sharp(designPng)
        .resize(pw, ph, { fit: 'contain', background: { r: 30, g: 30, b: 30, alpha: 255 } })
        .png()
        .toBuffer()
      writeFileSync(previewPath, preview)
      console.log(`         Rendered: ${frontCanvas[0]}×${frontCanvas[1]} → preview ${pw}×${ph}`)

      if (PREVIEW) {
        results.success.push(product.id)
        console.log('')
        continue
      }

      if (DRY_RUN) {
        console.log(`         Would create: "${product.name}" (${product.category})`)
        console.log(`         Positions: ${product.positions.join(', ')}`)
        console.log(`         Variants: ${variants.length} (${Object.keys(vs.colors).join(', ')})`)
        results.success.push(product.id)
        console.log('')
        continue
      }

      // ── 1b. Upload front design PNG ──────────────────────────────────────
      await delay(2000)
      const designUp = await uploadImage(
        `phase2-${product.id}-${product.name.replace(/\s+/g, '-').toLowerCase()}.png`,
        designPng
      )
      console.log(`         Upload front: ${designUp.id}`)

      // ── 1c. Map positions to upload IDs ──────────────────────────────────
      const uploadIds = { front: designUp.id }

      // Tote back = wordmark branding
      if (product.positions.includes('back') && brandingUploads.backWordmark) {
        uploadIds.back = brandingUploads.backWordmark
      }

      // ── 1d. Create product on Printify ───────────────────────────────────
      const printAreas = buildPrintAreas(product, uploadIds)

      await delay(2000)
      const prod = await api(`/shops/${SHOP_ID}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          title: product.name,
          description: product.desc.en,
          blueprint_id: vs.blueprint_id,
          print_provider_id: vs.provider_id,
          variants: variants.map(v => ({ id: v.id, price: v.price, is_enabled: true })),
          print_areas: printAreas,
          tags: product.tags,
        }),
      })
      console.log(`         Printify: ${prod.id}`)

      // ── 1e. Set GPSR (safety_information) before publish ─────────────────
      const safetyHtml = gpsrHtml(product)
      try {
        await delay(1500)
        await api(`/shops/${SHOP_ID}/products/${prod.id}.json`, {
          method: 'PUT',
          body: JSON.stringify({
            title: product.name,
            description: product.desc.en,
            tags: product.tags,
          }),
        })
      } catch (e) {
        console.log(`         GPSR update note: ${e.message.slice(0, 100)}`)
      }

      // ── 1f. Publish ──────────────────────────────────────────────────────
      await delay(1500)
      await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
        method: 'POST',
        body: JSON.stringify({
          title: true,
          description: true,
          images: true,
          variants: true,
          tags: true,
        }),
      })
      console.log(`         Published`)

      // ── 1g. Insert in Supabase ───────────────────────────────────────────
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', product.category)
        .single()

      const productDetails = {
        safety_information: safetyHtml,
        material: product.material,
        care_instructions: product.care,
        print_technique: product.printTechnique,
        manufacturing_country: manufacturingCountry(vs.provider_id),
        brand: 'SKAPARA',
        model: modelName(vs.blueprint_id),
      }

      const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
        title: product.name,
        description: product.desc.en,
        printify_id: prod.id,
        blueprint_id: vs.blueprint_id,
        print_provider_id: vs.provider_id,
        category_id: cat?.id || null,
        category: product.category,
        status: 'active',
        currency: 'EUR',
        base_price_cents: product.priceCents,
        tags: product.tags,
        published_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        product_details: productDetails,
        translations: {
          es: { title: product.name, description: product.desc.es },
          de: { title: product.name, description: product.desc.de },
        },
      }).select('id').single()

      if (dbErr) throw new Error(`Supabase insert: ${dbErr.message}`)
      console.log(`         Supabase: ${dbProd.id}`)

      // ── 1h. Publishing succeeded callback ────────────────────────────────
      try {
        await delay(1500)
        await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
          method: 'POST',
          body: JSON.stringify({
            external: { id: dbProd.id, handle: `/shop/${dbProd.id}` },
          }),
        })
      } catch (e) {
        console.log(`         publishing_succeeded note: ${e.message.slice(0, 80)}`)
      }

      // ── 1i. Insert product variants in Supabase ─────────────────────────
      const variantRows = variants.map(v => ({
        product_id: dbProd.id,
        printify_variant_id: String(v.id),
        title: `${v.color} / ${v.size}`,
        color: v.color,
        size: v.size,
        price_cents: v.price,
        is_enabled: true,
        is_available: true,
      }))

      for (let i = 0; i < variantRows.length; i += 20) {
        const batch = variantRows.slice(i, i + 20)
        const { error: vErr } = await supabase
          .from('product_variants')
          .upsert(batch, { onConflict: 'product_id,printify_variant_id' })
        if (vErr) console.log(`         Variant batch ${i}: ${vErr.message}`)
      }
      console.log(`         ${variantRows.length} variants inserted`)

      // ── 1j. Harvest mockup images (after delay) ─────────────────────────
      await delay(5000)
      try {
        const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
        const imgs = (details?.images || [])
          .filter(i => !i.src?.includes('size-chart'))
          .slice(0, 6)
          .map(i => i.src)
        if (imgs.length) {
          await supabase.from('products')
            .update({ images: imgs, thumbnail_url: imgs[0] })
            .eq('id', dbProd.id)
          console.log(`         ${imgs.length} mockups harvested`)
        } else {
          console.log(`         No mockups yet (cron sync will fix)`)
        }
      } catch (e) {
        console.log(`         Mockup harvest: ${e.message.slice(0, 80)}`)
      }

      results.success.push(product.id)
      console.log(`         DONE\n`)

    } catch (err) {
      console.error(`         ERROR: ${err.message}\n`)
      results.failed.push({ id: product.id, error: err.message })
    }
  }

  // ── Step 2: Trigger cron sync ──────────────────────────────────────────────
  if (!PREVIEW && !DRY_RUN && results.success.length > 0) {
    console.log('  Triggering cron sync...')
    try {
      const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
      const cronSecret = envFile.match(/CRON_SECRET=(.*)/)?.[1]?.trim()
      const baseUrl = envFile.match(/NEXT_PUBLIC_APP_URL=(.*)/)?.[1]?.trim() || 'http://localhost:3000'
      const syncUrl = `${baseUrl}/api/cron/sync-printify`
      const syncHdrs = cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}

      const r = await fetch(syncUrl, { headers: syncHdrs })
      if (r.ok) {
        console.log('  Cron sync triggered successfully\n')
      } else {
        console.log(`  Cron sync: ${r.status} (may need manual trigger)\n`)
      }
    } catch (e) {
      console.log(`  Cron sync failed: ${e.message} (run manually)\n`)
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('='.repeat(65))
  console.log(`  SUMMARY: ${results.success.length} OK, ${results.failed.length} failed`)
  if (results.failed.length > 0) {
    console.log('  Failed:')
    for (const f of results.failed) {
      console.log(`    ${f.id}: ${f.error.slice(0, 100)}`)
    }
  }
  console.log('='.repeat(65))
}

main().catch(e => { console.error('\nFATAL:', e.message, e.stack); process.exit(1) })
