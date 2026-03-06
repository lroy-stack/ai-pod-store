import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')

// Check a product that HAS GPSR (one of the branded ones)
const r = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products.json?limit=5`, {
  headers: { Authorization: `Bearer ${TOKEN}` }
})
const { data: prods } = await r.json()
for (const p of prods) {
  const gr = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products/${p.id}/gpsr.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  const g = await gr.json()
  if (g.manufacturer || g.responsible_person || g.safety_information) {
    console.log(`FOUND GPSR on: ${p.title} (${p.id})`)
    console.log(JSON.stringify(g, null, 2))
    break
  }
}
