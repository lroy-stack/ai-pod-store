import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')

// Get ALL products and check GPSR on each
let page = 1
let found = false
while (!found) {
  const r = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products.json?limit=10&page=${page}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  const body = await r.json()
  const prods = body.data || []
  if (prods.length === 0) break
  
  for (const p of prods) {
    const gr = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products/${p.id}/gpsr.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    })
    const g = await gr.json()
    const hasGpsr = g.manufacturer || g.responsible_person || g.safety_information
    if (hasGpsr) {
      console.log(`FOUND: ${p.title} (${p.id})`)
      console.log(JSON.stringify(g, null, 2))
      found = true
      break
    }
  }
  page++
  if (page > 5) break
}
if (!found) console.log('No products have GPSR set')
