import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')

const PRODUCTS = {
  2: { name: 'Bug Reporter',    pid: '69a38b2546730b56700a4018' },
  3: { name: 'Sudo Ice Cream',  pid: '69a38b5d1ec5ca402c0352e0' },
  4: { name: 'Bedtime 404',     pid: '69a38b853b12a90c8e089201' },
  5: { name: 'Ctrl+Z Homework', pid: '69a38bac5a653e214b0be2f4' },
  6: { name: 'AI Raised Me',    pid: '69a38bda3b12a90c8e08920c' },
  7: { name: 'Code Works',      pid: '69a38c03874d66e74c0ea105' },
}

async function main() {
  for (const [num, p] of Object.entries(PRODUCTS)) {
    const r = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products/${p.pid}.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    })
    const prod = await r.json()
    const imgs = (prod.images || []).filter(i => i.src)
    
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`  #${num} ${p.name} — ${imgs.length} images total`)
    console.log('═'.repeat(70))
    
    // Extract unique mockup generation IDs from URLs
    // Printify URLs: https://images-api.printify.com/mockup/{genId}/{imgId}/{filename}
    const genIds = new Set()
    for (const img of imgs) {
      const match = img.src.match(/\/mockup\/([a-f0-9]+)\//)
      if (match) genIds.add(match[1])
    }
    
    console.log(`  Unique generation batches: ${genIds.size}`)
    if (genIds.size > 1) {
      console.log(`  ⚠ MULTIPLE GENERATIONS — old mockups mixed with new!`)
    }
    
    // Group by generation batch
    const batches = {}
    for (const img of imgs) {
      const match = img.src.match(/\/mockup\/([a-f0-9]+)\//)
      const genId = match ? match[1] : 'unknown'
      if (!batches[genId]) batches[genId] = []
      const label = img.src.match(/camera_label=([^&]+)/)?.[1] || 'no-label'
      batches[genId].push({ label, default: img.is_default, variants: img.variant_ids?.length || 0 })
    }
    
    for (const [genId, batchImgs] of Object.entries(batches)) {
      console.log(`\n  Batch ${genId.slice(0,12)}...:`)
      for (const bi of batchImgs) {
        console.log(`    ${bi.label} (default:${bi.default}, ${bi.variants} variants)`)
      }
    }
    
    // Also show print_areas to confirm current state
    console.log(`\n  Current print_areas:`)
    for (const pa of prod.print_areas || []) {
      for (const ph of pa.placeholders || []) {
        for (const img of ph.images || []) {
          if (img.name === 'text_layer.svg') continue
          console.log(`    ${ph.position}: ${img.name} (x:${img.x} y:${img.y} scale:${img.scale})`)
        }
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
