import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')

const IDS = {
  'AI Raised Me':    '69a38bda3b12a90c8e08920c',
  'Code Works':      '69a38c03874d66e74c0ea105',
  'Ctrl+Z Homework': '69a38bac5a653e214b0be2f4',
  'Bug Reporter':    '69a38b2546730b56700a4018',
}

async function main() {
  for (const [name, pid] of Object.entries(IDS)) {
    const res = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products/${pid}.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    })
    const p = await res.json()
    console.log(`\n${name}:`)
    for (const pa of p.print_areas || []) {
      for (const ph of pa.placeholders || []) {
        for (const img of ph.images || []) {
          if (img.name === 'text_layer.svg') continue
          console.log(`  ${ph.position}: ${img.name}  x:${img.x} y:${img.y} scale:${img.scale}`)
        }
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
