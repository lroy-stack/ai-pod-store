import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...hdrs, ...opts.headers } })
  const text = await r.text()
  try { return JSON.parse(text) } catch { return text }
}

async function main() {
  // Upload a small test image (100x100 red square)
  const sharp = (await import('sharp')).default
  const testImg = await sharp({
    create: { width: 500, height: 500, channels: 4, background: { r: 200, g: 50, b: 50, alpha: 255 } }
  }).png().toBuffer()

  console.log('Uploading test image...')
  const upload = await api('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({ file_name: 'test-500px.png', contents: testImg.toString('base64') }),
  })
  console.log(`Upload ID: ${upload.id}\n`)

  await delay(1500)

  // Create test product with all 4 placeholders
  console.log('Creating test product with all 4 placeholders...')
  const whiteVariantId = 75008 // White / M

  const result = await api(`/shops/${SHOP_ID}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: '_TEST_BP793_PLACEHOLDERS',
      description: 'Placeholder inspection',
      blueprint_id: 793,
      print_provider_id: 410,
      variants: [{ id: whiteVariantId, price: 100, is_enabled: true }],
      print_areas: [{
        variant_ids: [whiteVariantId],
        placeholders: [
          { position: 'front_center_chest', images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'front_left_chest', images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'left_wrist', images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'right_wrist', images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
        ],
      }],
    }),
  })

  if (result.id) {
    console.log(`Product ID: ${result.id}\n`)

    await delay(2000)

    // Fetch product details
    const detail = await api(`/shops/${SHOP_ID}/products/${result.id}.json`)

    console.log('═══ PRINT AREAS ═══\n')
    for (const pa of detail.print_areas || []) {
      for (const ph of pa.placeholders || []) {
        console.log(`Position: ${ph.position}`)
        console.log(`  decoration_method: ${ph.decoration_method || 'unknown'}`)
        console.log(`  images: ${ph.images?.length || 0}`)
        if (ph.images?.[0]) {
          const img = ph.images[0]
          console.log(`  x=${img.x} y=${img.y} scale=${img.scale} w=${img.width} h=${img.height}`)
        }
        // Show all keys
        const keys = Object.keys(ph).filter(k => k !== 'images')
        for (const k of keys) {
          if (k !== 'position') console.log(`  ${k}: ${JSON.stringify(ph[k])}`)
        }
        console.log()
      }
    }

    // Check mockup images
    console.log('═══ MOCKUP IMAGES ═══\n')
    if (detail.images?.length) {
      for (const img of detail.images.slice(0, 4)) {
        console.log(`  ${img.src?.slice(0, 100)}`)
        console.log(`    variant_ids: ${img.variant_ids?.join(', ')}`)
        console.log(`    is_default: ${img.is_default}`)
        console.log()
      }
    } else {
      console.log('  No images yet (mockups may take time)')
    }

    // Delete test product
    await delay(500)
    await api(`/shops/${SHOP_ID}/products/${result.id}.json`, { method: 'DELETE' })
    console.log('Test product deleted.')
  } else {
    console.log('Product creation response:')
    console.log(JSON.stringify(result, null, 2).slice(0, 1000))
  }
}

main().catch(e => console.error('FATAL:', e.message))
