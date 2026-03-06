import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const { data } = await sb.from('products')
  .select('title, category, blueprint_id, print_provider_id, base_price_cents, status')
  .eq('status', 'active')
  .is('deleted_at', null)
  .order('category')

console.log(`Total active products: ${data.length}\n`)

const byCategory = {}
for (const p of data) {
  const cat = p.category || 'uncategorized'
  if (!byCategory[cat]) byCategory[cat] = []
  byCategory[cat].push(p)
}

for (const [cat, prods] of Object.entries(byCategory).sort()) {
  console.log(`\n${cat} (${prods.length}):`)
  for (const p of prods) {
    console.log(`  - "${p.title}" BP${p.blueprint_id}/P${p.print_provider_id} ${(p.base_price_cents/100).toFixed(2)}€`)
  }
}
