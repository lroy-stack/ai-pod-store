import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const headers = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const products = [
  { name: 'Facet (Beanie)', id: '69a22d7d7ab6ca00740893de' },
  { name: 'Nova (Cap)', id: '69a22d959f7e893e8a0dd451' },
  { name: 'Flux (Bucket)', id: '69a22daecf24bdf7260e618a' },
]

for (const p of products) {
  await delay(2000)
  const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${p.id}.json`, { headers })
  const d = await r.json()
  const front = (d.images || []).find(i => i.src.includes('front') && !i.src.includes('size-chart'))
  console.log(`${p.name}: ${front?.src || 'no front image'}`)
}
