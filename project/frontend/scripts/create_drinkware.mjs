import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'

// --- Load env ---
const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  if (line.includes('=') && !line.startsWith('#')) {
    const [k, ...rest] = line.trim().split('=')
    env[k] = rest.join('=')
  }
}
const PTOK = env.PRINTIFY_API_TOKEN
const SHOP = env.PRINTIFY_SHOP_ID

// --- Font stacks ---
const IMPACT = "'Impact','Arial Black',sans-serif"
const MONO   = "'Courier New','Monaco',monospace"
const BODY   = "'Arial','Helvetica Neue','Helvetica',sans-serif"

// --- Adapted SVGs: white → #1a1a1a, stroke white → stroke #1a1a1a ---
// Colored accents UNCHANGED

function design6_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.30}" font-family="${MONO}" font-size="${Math.round(w*0.028)}"
    font-weight="700" fill="#10B981" text-anchor="middle">career_progression.js — 2026 edition</text>
  <text x="${w*0.28}" y="${h*0.48}" font-family="${IMPACT}" font-size="${Math.round(w*0.05)}"
    font-weight="900" fill="#1a1a1a" text-anchor="middle" opacity="0.75">SENIOR</text>
  <text x="${w*0.28}" y="${h*0.58}" font-family="${IMPACT}" font-size="${Math.round(w*0.05)}"
    font-weight="900" fill="#1a1a1a" text-anchor="middle" opacity="0.75">DEV</text>
  <text x="${w*0.50}" y="${h*0.53}" font-family="${IMPACT}" font-size="${Math.round(w*0.06)}"
    font-weight="900" fill="#FBBF24" text-anchor="middle">\u2192</text>
  <text x="${w*0.74}" y="${h*0.48}" font-family="${IMPACT}" font-size="${Math.round(w*0.05)}"
    font-weight="900" fill="#10B981" text-anchor="middle">PROMPT</text>
  <text x="${w*0.74}" y="${h*0.58}" font-family="${IMPACT}" font-size="${Math.round(w*0.05)}"
    font-weight="900" fill="#10B981" text-anchor="middle">ENGINEER</text>
  <line x1="${w*0.1}" y1="${h*0.66}" x2="${w*0.9}" y2="${h*0.66}" stroke="#1a1a1a" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.90}" font-family="${BODY}" font-size="${Math.round(w*0.024)}"
    font-weight="700" fill="#666666" text-anchor="middle" opacity="0.9">\u00A9 2026 — All careers deprecated</text>
</svg>`
}

function design9_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.46}" font-family="${IMPACT}" font-size="${Math.round(w*0.058)}"
    font-weight="900" fill="#1a1a1a" text-anchor="middle" letter-spacing="3">I DIDN'T WRITE THIS CODE.</text>
  <line x1="${w*0.2}" y1="${h*0.53}" x2="${w*0.8}" y2="${h*0.53}" stroke="#1a1a1a" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.65}" font-family="${BODY}" font-size="${Math.round(w*0.048)}"
    font-weight="700" fill="#FBBF24" text-anchor="middle">But I take full credit.</text>
</svg>`
}

function design7_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.30}" font-family="${MONO}" font-size="${Math.round(w*0.050)}"
    font-weight="700" fill="#10B981" text-anchor="middle">$</text>
  <text x="${w/2}" y="${h*0.45}" font-family="${MONO}" font-size="${Math.round(w*0.068)}"
    font-weight="700" fill="#1a1a1a" text-anchor="middle">git reset --hard</text>
  <line x1="${w*0.15}" y1="${h*0.54}" x2="${w*0.85}" y2="${h*0.54}" stroke="#1a1a1a" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.65}" font-family="${BODY}" font-size="${Math.round(w*0.044)}"
    font-weight="700" fill="#1a1a1a" text-anchor="middle">The real AI undo button.</text>
  <text x="${w/2}" y="${h*0.76}" font-family="${MONO}" font-size="${Math.round(w*0.034)}"
    font-weight="700" fill="#EF4444" text-anchor="middle">// when Claude rewrites your entire codebase</text>
</svg>`
}

function design10_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.38}" font-family="${MONO}" font-size="${Math.round(w*0.055)}"
    font-weight="700" fill="#EF4444" text-anchor="middle">404</text>
  <text x="${w/2}" y="${h*0.55}" font-family="${IMPACT}" font-size="${Math.round(w*0.035)}"
    font-weight="900" fill="#1a1a1a" text-anchor="middle" letter-spacing="8">DEVELOPER NOT FOUND</text>
  <line x1="${w*0.25}" y1="${h*0.62}" x2="${w*0.75}" y2="${h*0.62}" stroke="#1a1a1a" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.73}" font-family="${BODY}" font-size="${Math.round(w*0.024)}"
    font-weight="700" fill="#666666" text-anchor="middle">replaced by Claude, ChatGPT &amp; Cursor — since 2026</text>
</svg>`
}

function design8_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.40}" font-family="${IMPACT}" font-size="${Math.round(w*0.065)}"
    font-weight="900" fill="#1a1a1a" text-anchor="middle" letter-spacing="2">IF IT AIN'T BROKE,</text>
  <text x="${w/2}" y="${h*0.53}" font-family="${IMPACT}" font-size="${Math.round(w*0.068)}"
    font-weight="900" fill="#A78BFA" text-anchor="middle" letter-spacing="2">I'LL REFACTOR IT</text>
  <text x="${w/2}" y="${h*0.65}" font-family="${IMPACT}" font-size="${Math.round(w*0.068)}"
    font-weight="900" fill="#A78BFA" text-anchor="middle" letter-spacing="2">ANYWAY.</text>
  <line x1="${w*0.2}" y1="${h*0.71}" x2="${w*0.8}" y2="${h*0.71}" stroke="#1a1a1a" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.80}" font-family="${BODY}" font-size="${Math.round(w*0.036)}"
    font-weight="700" fill="#666666" text-anchor="middle">— cursor agent, 3am, unsupervised</text>
</svg>`
}

// --- Products config ---
const PRODUCTS = [
  { title: 'Prompt Engineer', svgFn: design6_svg, bp: 1018, pid: 26, canvas: [2244, 945],
    vids: [79701,79702,80021,80022,80023,80024,80026,80027,80028,80029,80030], price: 1699 },
  { title: 'Full Credit', svgFn: design9_svg, bp: 1018, pid: 26, canvas: [2244, 945],
    vids: [79701,79702,80021,80022,80023,80024,80026,80027,80028,80029,80030], price: 1699 },
  { title: 'Git Reset', svgFn: design7_svg, bp: 1927, pid: 410, canvas: [2776, 2374],
    vids: [119530, 119531], price: 3099 },
  { title: '404 Dev', svgFn: design10_svg, bp: 966, pid: 86, canvas: [3058, 1715],
    vids: [78458], price: 2799 },
  { title: 'Refactor Anyway', svgFn: design8_svg, bp: 854, pid: 23, canvas: [2759, 1500],
    vids: [76801, 76802, 76803], price: 3699 },
]

// --- Helpers ---
function curlJson(method, path, data) {
  const url = `https://api.printify.com/v1/${path}`
  const args = ['-s', '-X', method, url,
    '-H', `Authorization: Bearer ${PTOK}`,
    '-H', 'Content-Type: application/json']
  if (data) args.push('-d', JSON.stringify(data))
  const result = execFileSync('curl', args, { maxBuffer: 50*1024*1024 }).toString()
  try { return JSON.parse(result) } catch { return {} }
}

// --- Main ---
const results = []

for (const prod of PRODUCTS) {
  console.log(`\n=== ${prod.title} ===`)
  const [w, h] = prod.canvas

  // 1. Generate SVG → PNG
  const svg = prod.svgFn(w, h)
  const pngBuf = await sharp(Buffer.from(svg)).resize(w, h).ensureAlpha().png().toBuffer()
  const b64 = pngBuf.toString('base64')
  console.log(`  PNG: ${w}x${h}, ${Math.round(pngBuf.length/1024)}KB`)

  // 2. Upload to Printify
  const upload = curlJson('POST', 'uploads/images.json', {
    file_name: `${prod.title.toLowerCase().replace(/\s+/g,'-')}-drinkware.png`,
    contents: b64
  })
  const uploadId = upload.id
  if (!uploadId) { console.log('  UPLOAD FAILED:', JSON.stringify(upload).slice(0,200)); continue }
  console.log(`  Upload: ${uploadId}`)

  // 3. Create product
  const variants = prod.vids.map(vid => ({ id: vid, price: prod.price, is_enabled: true }))
  const productData = {
    title: prod.title,
    blueprint_id: prod.bp,
    print_provider_id: prod.pid,
    variants,
    print_areas: [{
      variant_ids: prod.vids,
      placeholders: [{
        position: 'front',
        images: [{ id: uploadId, x: 0.5, y: 0.5, scale: 1, angle: 0 }]
      }]
    }]
  }
  const created = curlJson('POST', `shops/${SHOP}/products.json`, productData)
  const pfyId = created.id
  if (!pfyId) { console.log('  CREATE FAILED:', JSON.stringify(created).slice(0,200)); continue }
  console.log(`  Created: ${pfyId}`)

  // 4. Publish
  curlJson('POST', `shops/${SHOP}/products/${pfyId}/publish.json`, {
    title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: true
  })
  console.log(`  Published`)

  results.push({ title: prod.title, pfyId, uploadId, bp: prod.bp })
}

// Save results
writeFileSync('/tmp/drinkware_results.json', JSON.stringify(results, null, 2))
console.log(`\n=== ${results.length}/5 created ===`)
for (const r of results) console.log(`  ${r.title}: ${r.pfyId}`)
