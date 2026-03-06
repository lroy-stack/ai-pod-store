/**
 * SKAPARA Sneaker Fix v4b — Resume from uploaded images
 * Images already uploaded in v4. Just need to wait for unlock, update, publish.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(path, opts = {}) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { ...hdrs, ...opts.headers } })
    if (r.status === 429) {
      const wait = 20000 * (i + 1)
      console.log(`    ⏳ Rate limited, waiting ${wait / 1000}s...`)
      await delay(wait)
      continue
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
    const ct = r.headers.get('content-type') || ''
    return ct.includes('json') ? r.json() : null
  }
  throw new Error('Rate limit exceeded after 4 retries')
}

const PRODUCT_ID = '69a2d99619bf4a9b4f097875'

// Image IDs from successful v4 uploads
const upBody1  = '69a2e212861e2284acdad5c4'
const upBody2  = '69a2e2153250f9b614ace313'
const upTongue = '69a2e21968115669d4152a09'

async function waitForUnlock() {
  console.log('  Waiting for product to unlock...')
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${API}/shops/${SHOP}/products/${PRODUCT_ID}.json`, { headers: hdrs })
    const d = await r.json()
    if (!d.is_locked) {
      console.log(`  Unlocked after ~${i * 15}s`)
      return
    }
    process.stdout.write('.')
    await delay(15000)
  }
  throw new Error('Product still locked after 7.5 minutes')
}

async function main() {
  console.log('═'.repeat(60))
  console.log('  SNEAKERS v4b — Resume update (15% S mark)')
  console.log('═'.repeat(60))

  await waitForUnlock()

  // Get variants
  const varRes = await api('/catalog/blueprints/767/print_providers/90/variants.json')
  const vs = varRes.variants || []
  console.log(`  ${vs.length} variants`)

  // Update product with pre-uploaded images
  await delay(2000)
  await api(`/shops/${SHOP}/products/${PRODUCT_ID}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      print_areas: [{
        variant_ids: vs.map(v => v.id),
        placeholders: [
          { position: 'body_outside_left',  images: [{ id: upBody1,  x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'body_outside_right', images: [{ id: upBody2,  x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'body_inside_left',   images: [{ id: upBody2,  x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'body_inside_right',  images: [{ id: upBody1,  x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'tongue_left',        images: [{ id: upTongue, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'tongue_right',       images: [{ id: upTongue, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
        ],
      }],
    }),
  })
  console.log('  Product updated with 15% S mark designs')

  // Publish
  await delay(3000)
  await api(`/shops/${SHOP}/products/${PRODUCT_ID}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log('  Published')

  // Harvest mockups
  console.log('  Waiting 15s for mockup generation...')
  await delay(15000)

  const { data: [sneaker] } = await sb.from('products')
    .select('id').eq('printify_id', PRODUCT_ID).limit(1)

  try {
    const d = await api(`/shops/${SHOP}/products/${PRODUCT_ID}.json`)
    const imgs = (d?.images || []).filter(i => !i.src?.includes('size-chart')).slice(0, 8).map(i => i.src)
    if (imgs.length && sneaker) {
      await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', sneaker.id)
      console.log(`  ${imgs.length} mockups saved to Supabase`)
    }
  } catch (e) { console.log(`  Mockup harvest: ${e.message}`) }

  console.log('\n  SNEAKERS v4 ✓ — S at 15% panel height')
  console.log('═'.repeat(60))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
