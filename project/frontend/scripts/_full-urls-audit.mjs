import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')

// Focus on AI Raised Me and Code Works (user's main concern)
const PRODUCTS = {
  6: { name: 'AI Raised Me',    pid: '69a38bda3b12a90c8e08920c' },
  7: { name: 'Code Works',      pid: '69a38c03874d66e74c0ea105' },
  2: { name: 'Bug Reporter',    pid: '69a38b2546730b56700a4018' },
  3: { name: 'Sudo Ice Cream',  pid: '69a38b5d1ec5ca402c0352e0' },
}

async function main() {
  for (const [num, p] of Object.entries(PRODUCTS)) {
    const r = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products/${p.pid}.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    })
    const prod = await r.json()
    const imgs = (prod.images || []).filter(i => i.src && !i.src.includes('size-chart'))
    
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`  #${num} ${p.name}`)
    console.log('═'.repeat(70))
    
    // Show full URL paths (after the domain) to identify unique mockup IDs
    for (const img of imgs) {
      const label = img.src.match(/camera_label=([^&]+)/)?.[1] || 'no-label'
      // Extract the path after mockup/{productId}/
      const pathPart = img.src.replace(/^https:\/\/[^/]+\/mockup\/[^/]+\//, '')
      // The image ID is the second segment: mockup/{pid}/{variantId}/{imageId}/filename
      const segments = img.src.split('/')
      const variantId = segments[segments.length - 3] || '?'
      const imageId = segments[segments.length - 2] || '?'
      console.log(`  ${label.padEnd(20)} variant:${variantId.padEnd(6)} imgId:${imageId.padEnd(5)} default:${img.is_default}`)
    }

    // Also show the updated_at
    console.log(`\n  updated_at: ${prod.updated_at}`)
    console.log(`  created_at: ${prod.created_at}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
