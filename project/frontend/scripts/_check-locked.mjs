/**
 * Check all Printify products for locked/stuck-publishing state
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}` }

async function main() {
  const locked = []
  const all = []
  let page = 1

  while (true) {
    const r = await fetch(`${API}/shops/${SHOP}/products.json?page=${page}&limit=50`, { headers: hdrs })
    const data = await r.json()
    const products = data.data || []
    if (products.length === 0) break

    for (const p of products) {
      all.push(p)
      if (p.is_locked) {
        locked.push({ id: p.id, title: p.title, visible: p.visible })
      }
    }

    if (page >= (data.last_page || 1)) break
    page++
  }

  console.log(`Total products scanned: ${all.length} (${page} pages)`)
  console.log(`\nLocked (stuck in publishing): ${locked.length}`)
  for (const p of locked) {
    console.log(`  ${p.id} | ${p.title} | visible=${p.visible}`)
  }

  if (locked.length === 0) {
    console.log('\n  No locked products found!')
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
