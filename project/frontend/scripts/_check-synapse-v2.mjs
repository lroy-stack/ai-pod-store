import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const headers = { Authorization: `Bearer ${TOKEN}` }

const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/69a22732eb470f86b10579a4.json`, { headers })
const d = await r.json()
const imgs = (d.images || []).filter(i => !i.src.includes('size-chart'))
console.log(`Mockup images: ${imgs.length}`)
for (const [i, img] of imgs.slice(0, 8).entries()) {
  const label = img.src.match(/camera_label=([^&]+)/)?.[1] || 'unknown'
  console.log(`${i}: ${label}`)
  console.log(`   ${img.src}`)
}
