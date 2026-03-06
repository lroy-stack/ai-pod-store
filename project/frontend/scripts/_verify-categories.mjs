import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync('/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/.env.local', 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

async function main() {
  // 1. Top-level categories
  const { data: topLevel } = await sb.from('categories')
    .select('slug, name_en, sort_order, is_active, parent_id')
    .is('parent_id', null)
    .order('sort_order')

  console.log('=== TOP-LEVEL CATEGORIES ===')
  for (const c of topLevel) {
    console.log(`  ${c.is_active ? '✓' : '✗'} ${c.slug.padEnd(25)} ${c.name_en.padEnd(30)} sort:${c.sort_order}`)
  }

  // 2. Headwear subcategories
  const { data: hw } = await sb.from('categories').select('id').eq('slug', 'headwear').single()
  const { data: hwSubs } = await sb.from('categories')
    .select('slug, name_en, is_active')
    .eq('parent_id', hw.id)
    .order('sort_order')

  console.log('\n=== HEADWEAR SUBCATEGORIES ===')
  for (const c of hwSubs) console.log(`  ${c.slug.padEnd(20)} ${c.name_en}`)

  // 3. Hoodies & Sweatshirts subcategories
  const { data: hs } = await sb.from('categories').select('id').eq('slug', 'hoodies-sweatshirts').single()
  const { data: hsSubs } = await sb.from('categories')
    .select('slug, name_en, is_active')
    .eq('parent_id', hs.id)
    .order('sort_order')

  console.log('\n=== HOODIES & SWEATSHIRTS SUBCATEGORIES ===')
  for (const c of hsSubs) console.log(`  ${c.slug.padEnd(20)} ${c.name_en}`)

  // 4. Product count per active category
  console.log('\n=== PRODUCT COUNTS (active categories) ===')
  const { data: cats } = await sb.from('categories')
    .select('id, slug, name_en, parent_id')
    .eq('is_active', true)
    .order('sort_order')

  for (const cat of cats) {
    const { count } = await sb.from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', cat.id)
      .neq('status', 'deleted')
      .neq('status', 'archived')
    if (count > 0 || cat.parent_id === null) {
      const indent = cat.parent_id ? '    ' : '  '
      console.log(`${indent}${cat.slug.padEnd(22)} ${String(count).padStart(3)} products`)
    }
  }

  // 5. Archived posters
  const { data: archived } = await sb.from('products')
    .select('title, status, blueprint_id')
    .in('blueprint_id', [97, 1130])
  console.log('\n=== POSTER PRODUCTS ===')
  for (const p of archived || []) console.log(`  ${p.title} → ${p.status}`)

  // 6. Sample cap variant check
  console.log('\n=== SAMPLE CAP VARIANT CHECK (BP1744) ===')
  const { data: capProd } = await sb.from('products')
    .select('id, title')
    .eq('blueprint_id', 1744)
    .neq('status', 'deleted')
    .limit(1)
    .single()

  if (capProd) {
    const { data: capVars } = await sb.from('product_variants')
      .select('title, color, size')
      .eq('product_id', capProd.id)
      .limit(5)
    console.log(`  ${capProd.title}:`)
    for (const v of capVars) {
      console.log(`    "${v.title}" → color="${v.color}" size="${v.size}"`)
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
