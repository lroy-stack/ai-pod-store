import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  // 1. Get BP 793 blueprint details
  console.log('═══ BP 793 Blueprint Info ═══\n')
  const bpRes = await fetch(`${API}/catalog/blueprints/793.json`, { headers })
  const bp = await bpRes.json()
  console.log(`Title: ${bp.title}`)
  console.log(`Description: ${(bp.description || '').slice(0, 300)}`)
  console.log(`Images: ${bp.images?.length || 0}`)
  if (bp.images?.[0]) console.log(`  Sample: ${bp.images[0]}`)

  await delay(500)

  // 2. Get all providers for BP 793
  console.log('\n═══ Providers ═══\n')
  const provRes = await fetch(`${API}/catalog/blueprints/793/print_providers.json`, { headers })
  const provs = await provRes.json()
  for (const p of provs) {
    console.log(`  ${p.id}: ${p.title} (${p.location?.country || '?'})`)
  }

  // 3. For Printful (410), get detailed variant info + shipping
  await delay(500)
  console.log('\n═══ Provider 410 (Printful) — Variants ═══\n')
  const varRes = await fetch(`${API}/catalog/blueprints/793/print_providers/410/variants.json`, { headers })
  const varData = await varRes.json()

  // Show white variants specifically
  const whites = (varData.variants || []).filter(v => {
    const c = (v.options?.color || v.title || '').toLowerCase()
    return c.includes('white') || c.includes('bone')
  })
  console.log(`Total variants: ${varData.variants?.length}`)
  console.log(`White/Bone variants: ${whites.length}`)
  for (const w of whites.slice(0, 8)) {
    console.log(`  ${w.id}: ${w.title} | color=${w.options?.color} size=${w.options?.size}`)
  }

  // Show all unique colors
  const colors = [...new Set((varData.variants || []).map(v => v.options?.color || '?'))]
  console.log(`\nAll colors (${colors.length}): ${colors.join(', ')}`)

  // 4. Create a TEST product to inspect print_areas structure
  // Instead, let's look at the existing product we already have data for
  // Actually, let's get the shipping info
  await delay(500)
  console.log('\n═══ Provider 410 — Shipping ═══\n')
  const shipRes = await fetch(`${API}/catalog/blueprints/793/print_providers/410/shipping.json`, { headers })
  const shipData = await shipRes.json()
  console.log(JSON.stringify(shipData, null, 2).slice(0, 500))

  // 5. Check Printify Choice (99) for BP 793
  await delay(500)
  console.log('\n═══ Provider 99 (Printify Choice) ═══\n')
  const var99 = await fetch(`${API}/catalog/blueprints/793/print_providers/99/variants.json`, { headers })
  const vd99 = await var99.json()
  console.log(`Variants: ${vd99.variants?.length || 0}`)
  const colors99 = [...new Set((vd99.variants || []).map(v => v.options?.color || '?'))]
  console.log(`Colors: ${colors99.join(', ')}`)

  // Show white variants for provider 99
  const whites99 = (vd99.variants || []).filter(v => {
    const c = (v.options?.color || '').toLowerCase()
    return c.includes('white') || c.includes('bone')
  })
  console.log(`White variants: ${whites99.length}`)
  for (const w of whites99.slice(0, 4)) {
    console.log(`  ${w.id}: ${w.title}`)
  }

  // 6. Create a dummy product with Printful to see EXACT placeholder dimensions
  console.log('\n═══ Creating test product to inspect placeholders ═══\n')

  // Use a white variant
  const testVariant = whites[0] || varData.variants[0]
  if (!testVariant) {
    console.log('No variants available!')
    return
  }

  // We need an image to place — use an existing upload
  // Let's use a simple 1x1 transparent pixel to test
  const testUpload = await fetch(`${API}/uploads/images.json`, {
    method: 'POST',
    headers: { ...headers },
    body: JSON.stringify({
      file_name: 'test-1px.png',
      // 1x1 transparent PNG base64
      contents: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    }),
  })
  const testUploadData = await testUpload.json()
  console.log(`Test upload: ${testUploadData.id}`)

  await delay(1000)

  const testProduct = await fetch(`${API}/shops/${SHOP_ID}/products.json`, {
    method: 'POST',
    headers: { ...headers },
    body: JSON.stringify({
      title: '_TEST_DELETE_ME_793',
      description: 'Test product for placeholder inspection',
      blueprint_id: 793,
      print_provider_id: 410,
      variants: [{ id: testVariant.id, price: 100, is_enabled: true }],
      print_areas: [{
        variant_ids: [testVariant.id],
        placeholders: [
          {
            position: 'front_center_chest',
            images: [{ id: testUploadData.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
          },
          {
            position: 'front_left_chest',
            images: [{ id: testUploadData.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
          },
          {
            position: 'left_wrist',
            images: [{ id: testUploadData.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
          },
          {
            position: 'right_wrist',
            images: [{ id: testUploadData.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
          },
        ],
      }],
    }),
  })
  const testProd = await testProduct.json()
  console.log(`Test product created: ${testProd.id}`)

  // Now fetch it back to see exact print area specs
  await delay(1000)
  const detailRes = await fetch(`${API}/shops/${SHOP_ID}/products/${testProd.id}.json`, { headers })
  const detail = await detailRes.json()

  console.log('\n═══ PRINT AREAS DETAIL ═══\n')
  for (const pa of detail.print_areas || []) {
    for (const ph of pa.placeholders || []) {
      console.log(`Position: ${ph.position}`)
      console.log(`  Method: ${ph.decoration_method || 'unknown'}`)
      console.log(`  Images: ${ph.images?.length || 0}`)
      if (ph.images?.[0]) {
        const img = ph.images[0]
        console.log(`  Image: x=${img.x} y=${img.y} scale=${img.scale} angle=${img.angle}`)
      }
      // Check for dimension info
      console.log(`  Full placeholder: ${JSON.stringify(ph).slice(0, 400)}`)
      console.log()
    }
  }

  // Delete the test product
  await delay(500)
  await fetch(`${API}/shops/${SHOP_ID}/products/${testProd.id}.json`, { method: 'DELETE', headers })
  console.log('Test product deleted.\n')

  // 7. Check what images Printful expects for embroidery
  console.log('═══ NOTES ═══')
  console.log('BP 793 + Printful = EMBROIDERY ONLY')
  console.log('Placeholders: front_center_chest, front_left_chest, left_wrist, right_wrist')
  console.log('Embroidery constraints:')
  console.log('  - Max 7-12 colors depending on area')
  console.log('  - No gradients, no photos')
  console.log('  - Simple vector-style designs')
  console.log('  - Thread colors from Madeira Polyneon palette')
}

main().catch(e => console.error('FATAL:', e.message))
