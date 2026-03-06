/**
 * Quick fix: clear printify_id and save legacy ID in product_details.
 * Printify unpublish already completed — this only does Supabase update.
 */
import { readFileSync } from 'fs'
import { resolve, join } from 'path'

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')
const audit = JSON.parse(readFileSync(join(ROOT, 'scripts', 'phase1-audit.json'), 'utf8'))

async function run() {
  let ok = 0, fail = 0
  for (const p of audit.products) {
    if (!p.printify_id) continue

    // Get current product_details
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}&select=product_details`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
    })
    const data = await getRes.json()
    const details = data?.[0]?.product_details || {}
    details.legacy_printify_id = p.printify_id

    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ printify_id: null, product_details: details })
    })
    if (res.ok) {
      ok++
      console.log(`OK ${p.title}`)
    } else {
      fail++
      console.log(`FAIL ${p.title}: ${await res.text()}`)
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`)
}

run()
