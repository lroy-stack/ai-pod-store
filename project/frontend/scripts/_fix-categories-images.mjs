import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint) {
  const r = await fetch(`https://api.printify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  if (!r.ok) throw new Error(`Printify ${r.status}`)
  return r.json()
}

async function main() {
  // ─── Load categories ───────────────────────────────────────────────────────
  const { data: cats, error: catErr } = await sb.from('categories').select('id, slug, parent_id, name_en')
  if (catErr || !cats) { console.error('Cat error:', catErr?.message); return }
  const catBySlug = {}
  for (const c of cats) catBySlug[c.slug] = c.id

  console.log('Categories loaded:', Object.keys(catBySlug).join(', '))
  console.log('')

  // ─── Blueprint → correct category mapping ─────────────────────────────────
  // Based on what each BP actually IS
  const bpToCategory = {
    6:    'apparel/t-shirts',       // Bella Canvas 3001 Tee
    77:   'apparel/hoodies',        // Gildan Pullover Hoodie
    49:   'apparel/sweatshirts',    // Heavy Blend Crewneck
    97:   'home-decor/posters',     // Satin Poster
    145:  'apparel/t-shirts',       // Short Sleeve Tee
    353:  'drinkware/bottles-tumblers', // Tumbler
    429:  'accessories/tech-accessories', // Laptop Sleeve
    442:  'accessories/mouse-pads', // Mouse Pad
    455:  'apparel/hoodies',        // Zip-Up Hoodie
    457:  'apparel/sweatshirts',    // Crewneck Sweatshirt
    482:  'drinkware/bottles-tumblers', // Water Bottle
    693:  'drinkware/bottles-tumblers', // Tumbler
    793:  'apparel/hoodies',        // Pullover Hoodie
    794:  'accessories/stickers',   // Stickers
    854:  'drinkware/bottles-tumblers', // Bottle
    879:  'apparel/long-sleeves',   // Long Sleeve Crewneck
    969:  'accessories/mouse-pads', // Gaming Desk Mat
    1108: 'accessories/hats',       // Snapback Cap
    1128: 'accessories/hats',       // Hat
    1130: 'home-decor/posters',     // Framed Poster
    1446: 'accessories/hats',       // 5-Panel Cap
    1447: 'accessories/hats',       // Dad Hat
    1691: 'accessories/hats',       // Beanie
    1744: 'accessories/hats',       // Cap
    1910: 'accessories/hats',       // Bucket Hat
  }

  // ─── Get all non-deleted products ──────────────────────────────────────────
  const { data: all } = await sb.from('products').select('id, title, printify_id, blueprint_id, category_id, status, images')
    .not('status', 'eq', 'deleted')
    .order('title')

  console.log(`=== FIXING ${all.length} PRODUCTS ===\n`)

  let catFixed = 0, imgFixed = 0, imgFailed = 0

  for (const p of all) {
    const issues = []

    // ─── FIX CATEGORY ────────────────────────────────────────────────────────
    if (p.blueprint_id && bpToCategory[p.blueprint_id]) {
      const correctSlug = bpToCategory[p.blueprint_id].split('/').pop()
      const correctCatId = catBySlug[correctSlug]

      if (correctCatId && p.category_id !== correctCatId) {
        const oldCat = cats.find(c => c.id === p.category_id)
        const newCat = cats.find(c => c.id === correctCatId)
        await sb.from('products').update({ category_id: correctCatId }).eq('id', p.id)
        issues.push(`CAT: ${oldCat?.slug || 'NULL'} \u2192 ${newCat?.slug}`)
        catFixed++
      }
    }

    // ─── FIX IMAGES (sync from Printify if missing) ──────────────────────────
    const imgCount = Array.isArray(p.images) ? p.images.length : 0
    if (imgCount === 0 && p.printify_id) {
      try {
        await delay(600)
        const details = await api(`/shops/${SHOP_ID}/products/${p.printify_id}.json`)
        const mockups = (details?.images || [])
          .filter(i => i.src && !i.src.includes('size-chart'))
          .slice(0, 8)
          .map(i => ({ src: i.src, alt: p.title }))

        if (mockups.length > 0) {
          await sb.from('products').update({ images: mockups }).eq('id', p.id)
          issues.push(`IMGS: 0 → ${mockups.length}`)
          imgFixed++
        } else {
          issues.push('IMGS: 0 (Printify also 0)')
          imgFailed++
        }
      } catch (e) {
        issues.push(`IMGS: ERROR ${e.message}`)
        imgFailed++
      }
    }

    if (issues.length > 0) {
      console.log(`  ${p.title}: ${issues.join(' | ')}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`CATEGORIES FIXED: ${catFixed}`)
  console.log(`IMAGES SYNCED: ${imgFixed}`)
  console.log(`IMAGES FAILED: ${imgFailed}`)
  console.log('='.repeat(60))

  // ─── FINAL AUDIT ──────────────────────────────────────────────────────────
  console.log('\n=== FINAL STATE ===\n')
  const { data: final } = await sb.from('products').select('id, title, blueprint_id, category_id, status, images')
    .not('status', 'eq', 'deleted')
    .order('title')

  if (!final) { console.log('No products found'); return }

  // Refresh cats
  const catMap2 = {}
  for (const c of cats) catMap2[c.id] = c

  let stillNoImg = 0
  for (const p of final) {
    const cat = p.category_id ? catMap2[p.category_id] : null
    const parent = cat?.parent_id ? catMap2[cat.parent_id] : null
    const catChain = parent ? `${parent.slug}/${cat.slug}` : (cat ? cat.slug : 'NULL')
    const imgCount = Array.isArray(p.images) ? p.images.length : 0
    if (imgCount === 0) stillNoImg++
    const st = p.status === 'archived' ? '[ARC] ' : ''
    console.log(`${st}${p.title.substring(0,38).padEnd(40)} BP${String(p.blueprint_id||'?').padEnd(5)} imgs:${String(imgCount).padEnd(3)} cat:${catChain}`)
  }
  console.log(`\nStill missing images: ${stillNoImg}`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
