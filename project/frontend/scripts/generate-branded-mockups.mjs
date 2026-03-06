#!/usr/bin/env node
/**
 * Generate branded mockups for all products.
 *
 * Modes:
 *   --gallery         Generate locally + HTML preview (no upload)
 *   --upload          Upload to Supabase Storage + update DB
 *   --upload --ids    Upload only specific product IDs (comma-separated)
 *   --preview         Dry run: show what would be generated
 *   --category <slug> Filter by category
 *   --only <id>       Generate for a single product
 *   --force           Regenerate even if branded_hero_url exists
 *   --force-threshold Skip rembg, use Sharp threshold removal
 *
 * Examples:
 *   node scripts/generate-branded-mockups.mjs --gallery
 *   node scripts/generate-branded-mockups.mjs --upload --ids "abc,def,ghi"
 *   node scripts/generate-branded-mockups.mjs --preview --category t-shirts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(__dirname, '..')
const ENV_PATH = path.join(FRONTEND, '.env.local')

// ── Parse .env.local ────────────────────────────────────────────────────────
function loadEnv() {
  const content = fs.readFileSync(ENV_PATH, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

// ── Parse CLI args ──────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  const flags = {
    gallery: args.includes('--gallery'),
    upload: args.includes('--upload'),
    preview: args.includes('--preview'),
    force: args.includes('--force'),
    forceThreshold: args.includes('--force-threshold'),
    category: null,
    only: null,
    ids: null,
  }

  const catIdx = args.indexOf('--category')
  if (catIdx !== -1 && args[catIdx + 1]) flags.category = args[catIdx + 1]

  const onlyIdx = args.indexOf('--only')
  if (onlyIdx !== -1 && args[onlyIdx + 1]) flags.only = args[onlyIdx + 1]

  const idsIdx = args.indexOf('--ids')
  if (idsIdx !== -1 && args[idsIdx + 1]) flags.ids = args[idsIdx + 1].split(',').filter(Boolean)

  return flags
}

// ── Category → background mapping (mirrors mockup-backgrounds.ts) ───────────
// Keeping this inline avoids needing tsx to import the TS module.
// Source of truth: src/lib/mockup-backgrounds.ts

const CATEGORY_BG_MAP = {
  't-shirts': 'navy-gradient',
  'crewnecks': 'navy-gradient',
  'long-sleeves': 'navy-gradient',
  'tank-tops': 'navy-gradient',
  'pullover-hoodies': 'warm-gray',
  'zip-hoodies': 'warm-gray',
  'hoodies-sweatshirts': 'warm-gray',
  'caps': 'kraft-paper',
  'snapbacks': 'kraft-paper',
  'dad-hats': 'kraft-paper',
  '5-panel-caps': 'kraft-paper',
  'beanies': 'kraft-paper',
  'bucket-hats': 'kraft-paper',
  'headwear': 'kraft-paper',
  'mugs': 'wood-light',
  'drinkware': 'wood-dark',
  'tumblers': 'dark-marble',
  'bottles': 'dark-marble',
  'tote-bags': 'sand-beige',
  'sneakers': 'urban-gray',
  'shoes': 'urban-gray',
  'desk-mats': 'desk-surface',
  'mouse-pads': 'desk-surface',
  'laptop-sleeves': 'desk-surface',
  'kids': 'soft-pastel',
  'kids-tshirts': 'soft-pastel',
  'kids-sweatshirts': 'soft-pastel',
  'baby-clothing': 'soft-pastel',
  'stickers': 'sticker-surface',
  'phone-cases': 'clean-white',
  'socks': 'clean-white',
  'accessories': 'clean-white',
  // Parent categories
  'apparel': 'navy-gradient',
}

function loadBackgroundSVGs() {
  const bgPath = path.join(FRONTEND, 'src/lib/mockup-backgrounds.ts')
  const code = fs.readFileSync(bgPath, 'utf-8')

  // Extract SVG strings and productZones from the TS source file
  const backgrounds = {}

  // Find each background object definition
  const bgRegex = /id:\s*'([^']+)'[\s\S]*?svg:\s*`([\s\S]*?)`[\s\S]*?productZone:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)\s*\}/g
  let match
  while ((match = bgRegex.exec(code)) !== null) {
    backgrounds[match[1]] = {
      id: match[1],
      svg: match[2],
      productZone: {
        x: parseInt(match[3]),
        y: parseInt(match[4]),
        w: parseInt(match[5]),
        h: parseInt(match[6]),
      },
    }
  }

  return backgrounds
}

let _bgCache = null
function getBackgroundForCategory(categorySlug) {
  if (!_bgCache) _bgCache = loadBackgroundSVGs()

  const bgId = CATEGORY_BG_MAP[categorySlug] || 'clean-white'
  const bg = _bgCache[bgId] || _bgCache['clean-white']
  return bg
}

// ── Background removal (Sharp threshold) ────────────────────────────────────
const WHITE_THRESHOLD = 235

async function removeWhiteBackground(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const ch = info.channels

  for (let i = 0; i < pixels.length; i += ch) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
    if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
      pixels[i + 3] = 0
    } else if (r > WHITE_THRESHOLD - 20 && g > WHITE_THRESHOLD - 20 && b > WHITE_THRESHOLD - 20) {
      const avg = (r + g + b) / 3
      const factor = Math.max(0, (avg - (WHITE_THRESHOLD - 20)) / 20)
      pixels[i + 3] = Math.round(255 * (1 - factor))
    }
  }

  return sharp(Buffer.from(pixels.buffer), {
    raw: { width: info.width, height: info.height, channels: info.channels },
  }).png().toBuffer()
}

// ── Background removal via rembg sidecar ────────────────────────────────────
async function removeBackgroundRembg(imageBuffer, rembgUrl = 'http://localhost:8080') {
  try {
    const resp = await fetch(`${rembgUrl}/api/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: imageBuffer,
      signal: AbortSignal.timeout(30000),
    })
    if (!resp.ok) return null
    return Buffer.from(await resp.arrayBuffer())
  } catch {
    return null
  }
}

// ── Generate a single branded mockup ────────────────────────────────────────
async function generateOne(product, background, opts = {}) {
  const { forceThreshold = false } = opts
  const mockupUrl = getFirstImageUrl(product.images)
  if (!mockupUrl) return { error: 'No mockup image available' }

  // 1. Fetch mockup
  const resp = await fetch(mockupUrl, {
    headers: { 'User-Agent': 'POD-AI-Store/1.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (!resp.ok) return { error: `Fetch failed: HTTP ${resp.status}` }
  const mockupBuffer = Buffer.from(await resp.arrayBuffer())

  // 2. Remove background
  let transparent
  if (!forceThreshold) {
    transparent = await removeBackgroundRembg(mockupBuffer)
    if (!transparent) {
      transparent = await removeWhiteBackground(mockupBuffer)
    }
  } else {
    transparent = await removeWhiteBackground(mockupBuffer)
  }

  // 3. Render background SVG
  const bgBuffer = await sharp(Buffer.from(background.svg))
    .resize(1200, 1200)
    .png()
    .toBuffer()

  // 4. Resize product to fit zone
  const zone = background.productZone
  const productResized = await sharp(transparent)
    .resize(zone.w, zone.h, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const meta = await sharp(productResized).metadata()
  const pw = meta.width || zone.w
  const ph = meta.height || zone.h
  const ox = zone.x + Math.round((zone.w - pw) / 2)
  const oy = zone.y + Math.round((zone.h - ph) / 2)

  // 5. Composite
  const output = await sharp(bgBuffer)
    .composite([{ input: productResized, left: ox, top: oy, blend: 'over' }])
    .webp({ quality: 85 })
    .toBuffer()

  return { buffer: output, mockupBuffer }
}

// ── Helper: get first image URL from product ────────────────────────────────
function getFirstImageUrl(images) {
  if (!Array.isArray(images) || images.length === 0) return null
  const img = images[0]
  return img.src || img.url || null
}

// ── Gallery HTML generator ──────────────────────────────────────────────────
function generateGalleryHTML(manifest) {
  const grouped = {}
  for (const item of manifest) {
    const cat = item.categorySlug || 'unknown'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  let cards = ''
  for (const [category, items] of Object.entries(grouped).sort()) {
    cards += `<h2 style="grid-column:1/-1;margin:24px 0 8px;font-size:20px;color:#40ACCC;text-transform:uppercase;letter-spacing:2px;">${category} (${items.length})</h2>\n`
    for (const item of items) {
      cards += `
      <div class="card" data-id="${item.productId}" data-cat="${category}">
        <div class="compare">
          <div class="img-box">
            <div class="label">BEFORE</div>
            <img src="original/${item.productId}.jpg" alt="Original" loading="lazy"/>
          </div>
          <div class="img-box">
            <div class="label branded">AFTER</div>
            <img src="branded/${item.productId}.webp" alt="Branded" loading="lazy"/>
          </div>
        </div>
        <div class="info">
          <label><input type="checkbox" class="approve-cb" value="${item.productId}" checked/> ${item.title.slice(0, 50)}</label>
          <span class="bg-tag">${item.backgroundId}</span>
        </div>
      </div>`
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SKAPARA — Branded Mockup Gallery Preview</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #0F172A; color: #F0EDE8; padding: 24px; }
  h1 { text-align: center; font-size: 28px; margin-bottom: 8px; letter-spacing: 3px; }
  .subtitle { text-align: center; color: #94A3B8; margin-bottom: 24px; font-size: 14px; }
  .controls { display: flex; gap: 12px; justify-content: center; margin-bottom: 24px; flex-wrap: wrap; }
  .controls button { background: #1E293B; color: #F0EDE8; border: 1px solid #334155; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .controls button:hover { background: #334155; }
  .controls button.active { background: #40ACCC; color: #0F172A; border-color: #40ACCC; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); gap: 16px; }
  .card { background: #1E293B; border-radius: 10px; overflow: hidden; border: 1px solid #334155; }
  .compare { display: flex; gap: 2px; }
  .img-box { flex: 1; position: relative; }
  .img-box img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
  .label { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,0.6); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: 1px; }
  .label.branded { background: rgba(64,172,204,0.8); }
  .info { padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; }
  .info label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .bg-tag { background: #334155; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #94A3B8; }
  .approve-cb { accent-color: #40ACCC; width: 16px; height: 16px; }
  #export-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #0F172A; border-top: 1px solid #334155; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; z-index: 10; }
  #export-bar .count { font-size: 14px; color: #94A3B8; }
  #export-bar button { background: #10B981; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
  #export-bar button:hover { background: #059669; }
</style>
</head>
<body>
<h1>SKAPARA MOCKUP GALLERY</h1>
<p class="subtitle">Branded mockup preview — select products to approve, then export IDs</p>
<div class="controls">
  <button onclick="selectAll(true)" class="active">Select All</button>
  <button onclick="selectAll(false)">Deselect All</button>
  <button onclick="toggleView()">Toggle Before/After</button>
</div>
<div class="grid">
${cards}
</div>
<div id="export-bar">
  <span class="count" id="count-display">0 selected</span>
  <button onclick="exportIds()">Copy Approved IDs</button>
</div>
<script>
  function updateCount() {
    const cbs = document.querySelectorAll('.approve-cb');
    const checked = [...cbs].filter(c => c.checked).length;
    document.getElementById('count-display').textContent = checked + ' / ' + cbs.length + ' selected';
  }
  document.querySelectorAll('.approve-cb').forEach(cb => cb.addEventListener('change', updateCount));
  updateCount();

  function selectAll(state) {
    document.querySelectorAll('.approve-cb').forEach(cb => cb.checked = state);
    updateCount();
  }

  function exportIds() {
    const ids = [...document.querySelectorAll('.approve-cb:checked')].map(cb => cb.value);
    const text = ids.join(',');
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied ' + ids.length + ' product IDs to clipboard!\\n\\nRun:\\nnode scripts/generate-branded-mockups.mjs --upload --ids "' + text.slice(0, 80) + '..."');
    });
  }

  let showBranded = true;
  function toggleView() {
    showBranded = !showBranded;
    document.querySelectorAll('.compare').forEach(el => {
      const boxes = el.querySelectorAll('.img-box');
      if (showBranded) {
        boxes[0].style.display = '';
        boxes[1].style.display = '';
      } else {
        // Show only branded
        boxes[0].style.display = 'none';
        boxes[1].style.display = '';
        boxes[1].querySelector('img').style.width = '100%';
      }
    });
  }
</script>
</body>
</html>`
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  const flags = parseArgs()
  const env = loadEnv()

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local')
    process.exit(1)
  }

  const sb = createClient(supabaseUrl, supabaseKey)

  // ── Fetch products ──────────────────────────────────────────────────────
  let query = sb
    .from('products')
    .select('id, title, images, category_id, branded_hero_url, categories(slug)')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (flags.only) {
    query = query.eq('id', flags.only)
  }

  const { data: products, error } = await query

  if (error) {
    console.error('Failed to fetch products:', error.message)
    process.exit(1)
  }

  // Filter by category
  let filtered = products || []
  if (flags.category) {
    filtered = filtered.filter(p => p.categories?.slug === flags.category)
  }

  // Filter by IDs (for --upload --ids)
  if (flags.ids) {
    const idSet = new Set(flags.ids)
    filtered = filtered.filter(p => idSet.has(p.id))
  }

  // Skip products that already have branded_hero_url (unless --force)
  if (!flags.force && !flags.gallery) {
    filtered = filtered.filter(p => !p.branded_hero_url)
  }

  console.log(`\n  SKAPARA Branded Mockup Generator`)
  console.log(`  ─────────────────────────────────`)
  console.log(`  Total active products: ${products.length}`)
  console.log(`  To process: ${filtered.length}`)
  console.log(`  Mode: ${flags.gallery ? 'GALLERY' : flags.upload ? 'UPLOAD' : flags.preview ? 'PREVIEW' : 'DRY RUN'}`)
  console.log(`  Threshold: ${flags.forceThreshold ? 'FORCED' : 'auto (rembg → threshold)'}`)
  console.log()

  if (filtered.length === 0) {
    console.log('  Nothing to process.')
    return
  }

  // ── Preview mode ────────────────────────────────────────────────────────
  if (flags.preview) {
    for (const p of filtered) {
      const catSlug = p.categories?.slug || 'unknown'
      const bg = getBackgroundForCategory(catSlug)
      const imgUrl = getFirstImageUrl(p.images)
      console.log(`  ${p.id.slice(0, 8)}  ${p.title.slice(0, 40).padEnd(42)}  ${catSlug.padEnd(20)}  bg: ${bg.id.padEnd(16)}  img: ${imgUrl ? 'OK' : 'NONE'}`)
    }
    console.log(`\n  Would generate ${filtered.length} branded mockups.`)
    return
  }

  // ── Gallery mode ────────────────────────────────────────────────────────
  if (flags.gallery) {
    const previewDir = path.join(FRONTEND, 'public/mockup-preview')
    const originalDir = path.join(previewDir, 'original')
    const brandedDir = path.join(previewDir, 'branded')

    fs.mkdirSync(originalDir, { recursive: true })
    fs.mkdirSync(brandedDir, { recursive: true })

    const manifest = []
    let ok = 0, fail = 0

    for (let i = 0; i < filtered.length; i++) {
      const p = filtered[i]
      const catSlug = p.categories?.slug || 'unknown'
      const bg = getBackgroundForCategory(catSlug)
      const imgUrl = getFirstImageUrl(p.images)

      process.stdout.write(`  [${i + 1}/${filtered.length}] ${p.title.slice(0, 40).padEnd(42)} `)

      if (!imgUrl) {
        console.log('SKIP (no image)')
        fail++
        continue
      }

      try {
        const result = await generateOne(p, bg, { forceThreshold: flags.forceThreshold })

        if (result.error) {
          console.log(`FAIL: ${result.error}`)
          fail++
          continue
        }

        // Save branded mockup
        fs.writeFileSync(path.join(brandedDir, `${p.id}.webp`), result.buffer)

        // Save original mockup
        if (result.mockupBuffer) {
          fs.writeFileSync(path.join(originalDir, `${p.id}.jpg`), result.mockupBuffer)
        }

        manifest.push({
          productId: p.id,
          title: p.title,
          categorySlug: catSlug,
          backgroundId: bg.id,
          originalUrl: imgUrl,
        })

        console.log(`OK (${bg.id})`)
        ok++
      } catch (err) {
        console.log(`ERROR: ${err.message}`)
        fail++
      }

      // Rate limit: 500ms between requests to avoid overwhelming CDN/rembg
      if (i < filtered.length - 1) await delay(500)
    }

    // Write manifest
    fs.writeFileSync(
      path.join(previewDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )

    // Generate HTML gallery
    const html = generateGalleryHTML(manifest)
    fs.writeFileSync(path.join(previewDir, 'gallery.html'), html)

    // Add to .gitignore if not present
    const gitignorePath = path.join(FRONTEND, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8')
      if (!gitignore.includes('mockup-preview')) {
        fs.appendFileSync(gitignorePath, '\n# Branded mockup preview\npublic/mockup-preview/\n')
      }
    }

    console.log(`\n  ─────────────────────────────────`)
    console.log(`  Gallery generated: ${ok} OK, ${fail} failed`)
    console.log(`  Open: ${path.join(previewDir, 'gallery.html')}`)
    console.log(`  Run: open "${path.join(previewDir, 'gallery.html')}"`)
    return
  }

  // ── Upload mode ───────────────────────────────────────────────────────
  if (flags.upload) {
    let ok = 0, fail = 0

    for (let i = 0; i < filtered.length; i++) {
      const p = filtered[i]
      const catSlug = p.categories?.slug || 'unknown'
      const bg = getBackgroundForCategory(catSlug)

      process.stdout.write(`  [${i + 1}/${filtered.length}] ${p.title.slice(0, 40).padEnd(42)} `)

      const imgUrl = getFirstImageUrl(p.images)
      if (!imgUrl) {
        console.log('SKIP (no image)')
        fail++
        continue
      }

      try {
        const result = await generateOne(p, bg, { forceThreshold: flags.forceThreshold })
        if (result.error) {
          console.log(`FAIL: ${result.error}`)
          fail++
          continue
        }

        // Upload to Supabase Storage
        const filename = `branded-mockups/${p.id}.webp`
        const { error: uploadError } = await sb.storage
          .from('mockups')
          .upload(filename, result.buffer, {
            contentType: 'image/webp',
            cacheControl: '31536000',
            upsert: true,
          })

        if (uploadError) {
          console.log(`UPLOAD FAIL: ${uploadError.message}`)
          fail++
          continue
        }

        // Get public URL
        const { data: { publicUrl } } = sb.storage
          .from('mockups')
          .getPublicUrl(filename)

        // Update product record
        const { error: updateError } = await sb
          .from('products')
          .update({ branded_hero_url: publicUrl })
          .eq('id', p.id)

        if (updateError) {
          console.log(`DB UPDATE FAIL: ${updateError.message}`)
          fail++
          continue
        }

        console.log(`OK → ${publicUrl.slice(0, 60)}...`)
        ok++
      } catch (err) {
        console.log(`ERROR: ${err.message}`)
        fail++
      }

      if (i < filtered.length - 1) await delay(1000)
    }

    console.log(`\n  ─────────────────────────────────`)
    console.log(`  Upload complete: ${ok} OK, ${fail} failed`)
    return
  }

  // Default: show help
  console.log('  No mode specified. Use --gallery, --upload, or --preview.')
  console.log('  Run with --help for usage.')
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
