/**
 * Unlock stuck-publishing Printify products
 * Tries multiple approaches:
 * 1. POST /publishing_succeeded.json (notify Printify the publish completed)
 * 2. POST /unpublish.json (cancel the publish)
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const LOCKED_IDS = [
  '69a2d99619bf4a9b4f097875', // SKAPARA Step — Low Top Sneaker
  '69a2d977414758b6c602cd57', // SKAPARA Grip — Desk Mat
  '69a2d95beb470f86b105a7e8', // SKAPARA Edge — Long Sleeve
  '69a23e207fc2996b8d0a4385', // GPU — Embroidered Bucket Hat
  '699def8760fee2efa007fc16', // Sammy Boy
  '699def7e22af2a30f104cbb7', // Sammy Boy
]

async function tryUnlock(productId, title) {
  console.log(`\n  ${title} (${productId})`)

  // Approach 1: Notify publishing succeeded
  try {
    const r1 = await fetch(`${API}/shops/${SHOP}/products/${productId}/publishing_succeeded.json`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ external: { id: productId, handle: `https://skapara.com/product/${productId}` } })
    })
    const body1 = await r1.text()
    console.log(`    publishing_succeeded: HTTP ${r1.status} — ${body1.slice(0, 150)}`)
    if (r1.ok) return true
  } catch (e) {
    console.log(`    publishing_succeeded: ERROR — ${e.message}`)
  }

  await delay(2000)

  // Approach 2: Unpublish
  try {
    const r2 = await fetch(`${API}/shops/${SHOP}/products/${productId}/unpublish.json`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({})
    })
    const body2 = await r2.text()
    console.log(`    unpublish: HTTP ${r2.status} — ${body2.slice(0, 150)}`)
    if (r2.ok) return true
  } catch (e) {
    console.log(`    unpublish: ERROR — ${e.message}`)
  }

  return false
}

async function main() {
  console.log('═'.repeat(60))
  console.log('  UNLOCK STUCK PRODUCTS')
  console.log('═'.repeat(60))

  for (const id of LOCKED_IDS) {
    await tryUnlock(id, id)
    await delay(2000)
  }

  // Check results
  console.log('\n' + '─'.repeat(60))
  console.log('  VERIFICATION')
  console.log('─'.repeat(60))
  await delay(5000)

  for (const id of LOCKED_IDS) {
    const r = await fetch(`${API}/shops/${SHOP}/products/${id}.json`, { headers: hdrs })
    const d = await r.json()
    const status = d.is_locked ? '🔒 STILL LOCKED' : '🔓 UNLOCKED'
    console.log(`  ${status} | ${d.title}`)
    await delay(500)
  }

  console.log('\n' + '═'.repeat(60))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
