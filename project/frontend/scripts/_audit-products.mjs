import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function deleteProd(p) {
  if (p.printify_id) {
    try {
      const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${p.printify_id}.json`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` }
      })
      console.log(`  Printify: ${r.ok ? 'DELETED' : r.status}`)
    } catch (e) { console.log(`  Printify: ${e.message}`) }
    await delay(500)
  }
  await sb.from('product_variants').delete().eq('product_id', p.id)
  const { error } = await sb.from('products').delete().eq('id', p.id)
  console.log(`  DB: ${error ? error.message : 'DELETED'}`)
}

async function main() {
  // ─── 1. DELETE ALL E2E + TREND-E2E ─────────────────────────────────────────
  const { data: e2e } = await sb.from('products').select('id, title, printify_id')
    .or('title.ilike.%[E2E]%,title.ilike.%[TREND-E2E]%')

  console.log(`=== DELETING ${e2e.length} E2E PRODUCTS ===\n`)
  for (const [i, p] of e2e.entries()) {
    console.log(`[${i+1}/${e2e.length}] ${p.title}`)
    await deleteProd(p)
  }

  // ─── 2. Delete remaining generic/trend products (non-meme, non-brand) ──────
  const genericPatterns = [
    'Cherry Blossom Spring',
    'Groovy 70s Mushroom Power',
    'Minimalist Cat Watercolor',
    'Playful Dog Cartoon',
    'Spring Easter Floral Eggs',
    'Celestial Moon Phases Astrology Mug',
    'Easter Bunny Pastel Watercolor Mug',
    'Groovy 70s Retro Psychedelic Mug',
    'Groovy Cat Meow Retro 70s Mug',
    'Phoenix Rising Flames Fire Mug',
    'Watercolor Cactus Succulent Botanical Mug',
  ]

  for (const pattern of genericPatterns) {
    const { data: found } = await sb.from('products').select('id, title, printify_id')
      .ilike('title', `%${pattern}%`)
    if (found && found.length > 0) {
      for (const p of found) {
        console.log(`\nCleaning generic: ${p.title}`)
        await deleteProd(p)
      }
    }
  }

  // ─── 3. AUDIT remaining products ──────────────────────────────────────────
  console.log('\n' + '='.repeat(70))
  console.log('  PRODUCT AUDIT — Remaining Active Products')
  console.log('='.repeat(70) + '\n')

  const { data: all, error: allErr } = await sb.from('products').select('id, title, printify_id, blueprint_id, print_provider_id, category_id, status, images, thumbnail_url')
    .order('title')

  if (allErr) { console.error('Query error:', allErr.message); return }

  const { data: cats } = await sb.from('categories').select('id, name, slug, parent_id')
  const catMap = {}
  if (cats) for (const c of cats) catMap[c.id] = c

  let noImg = 0, noThumb = 0, noCat = 0, archived = 0, deleted = 0, active = 0
  const activeProds = []

  for (const p of all) {
    if (p.status === 'deleted') { deleted++; continue }
    if (p.status === 'archived') { archived++ }
    active++

    const imgCount = Array.isArray(p.images) ? p.images.length : 0
    const hasThumb = p.thumbnail_url ? true : false
    const cat = p.category_id && catMap[p.category_id] ? catMap[p.category_id] : null
    const parentCat = cat && cat.parent_id && catMap[cat.parent_id] ? catMap[cat.parent_id] : null
    const catChain = parentCat ? `${parentCat.slug}/${cat.slug}` : (cat ? cat.slug : 'NULL')

    const issues = []
    if (imgCount === 0) { issues.push('NO_IMAGES'); noImg++ }
    if (!hasThumb) { issues.push('NO_THUMB'); noThumb++ }
    if (!p.category_id) { issues.push('NO_CAT'); noCat++ }

    const flag = issues.length > 0 ? ` *** ${issues.join(', ')}` : ''
    const st = p.status === 'archived' ? 'ARC' : '   '
    console.log(`${st} ${p.title.substring(0,40).padEnd(42)} BP${String(p.blueprint_id||'?').padEnd(5)} P${String(p.print_provider_id||'?').padEnd(4)} imgs:${String(imgCount).padEnd(3)} thumb:${hasThumb ? 'Y' : 'N'} cat:${catChain}${flag}`)

    activeProds.push({ ...p, issues, catChain, imgCount })
  }

  console.log('\n' + '-'.repeat(70))
  console.log(`TOTAL: ${all.length} (active: ${active}, deleted: ${deleted})`)
  console.log(`ISSUES: NO_IMAGES=${noImg} | NO_THUMB=${noThumb} | NO_CAT=${noCat} | ARCHIVED=${archived}`)

  // Category breakdown
  console.log('\nCATEGORY BREAKDOWN (non-deleted):')
  const catCounts = {}
  for (const p of activeProds) {
    const key = p.catChain || 'UNCATEGORIZED'
    catCounts[key] = (catCounts[key] || 0) + 1
  }
  for (const [k, v] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`)
  }

  // Products with issues detail
  const withIssues = activeProds.filter(r => r.issues.length > 0 && r.status !== 'archived')
  if (withIssues.length > 0) {
    console.log(`\nPRODUCTS WITH ISSUES (${withIssues.length}):`)
    for (const p of withIssues) {
      console.log(`  ${p.title} → ${p.issues.join(', ')} | printify:${p.printify_id || 'NONE'}`)
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
